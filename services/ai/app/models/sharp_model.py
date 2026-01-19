import os
import logging
import time
import threading
import gc
import torch
import torch.nn.functional as F
import numpy as np
import subprocess
from pathlib import Path
from ..config import Config

# Try to import the library components
try:
    from sharp.models import create_predictor, PredictorParams
    from sharp.utils import io as sharp_io
    from sharp.utils.gaussians import save_ply, unproject_gaussians
    SHARP_AVAILABLE = True
except ImportError as e:
    SHARP_AVAILABLE = False
    SHARP_IMPORT_ERROR = str(e)

logger = logging.getLogger(__name__)

class SharpModel:
    """
    Memory-managed wrapper for Apple ml-sharp Gaussian Splatting model.
    Keeps model in VRAM for fast generation, unloads after idle timeout.
    """
    
    CHECKPOINT_URL = "https://ml-site.cdn-apple.com/models/sharp/sharp_2572gikvuh.pt"
    CHECKPOINT_DIR = Path.home() / ".cache/torch/hub/checkpoints"
    CHECKPOINT_FILENAME = "sharp_2572gikvuh.pt"
    INTERNAL_SHAPE = (1536, 1536) # Default 1536 is required for multi-scale patch alignment
    
    def __init__(self):
        self._model = None
        self.device = "cpu" # Enforcing CPU as requested
        self._is_downloaded = None
        
        # Idle timeout management
        self.last_used = 0
        self.timeout_minutes = 30
        self._stop_monitor = False
        self._monitor_thread = None
        self._start_monitor()

    @property
    def checkpoint_path(self) -> Path:
        return self.CHECKPOINT_DIR / self.CHECKPOINT_FILENAME
    
    def _start_monitor(self):
        """Start background thread to monitor idle time."""
        def monitor_loop():
            logger.info(f"[SharpModel] Idle monitor started. Timeout: {self.timeout_minutes} mins")
            while not self._stop_monitor:
                if self._model is not None:
                    elapsed_mins = (time.time() - self.last_used) / 60
                    if elapsed_mins > self.timeout_minutes:
                        logger.info(f"[SharpModel] Idle for {elapsed_mins:.1f} mins. Unloading...")
                        self.unload_model()
                time.sleep(60) 
        self._monitor_thread = threading.Thread(target=monitor_loop, daemon=True)
        self._monitor_thread.start()

    def is_downloaded(self) -> bool:
        if self._is_downloaded is None:
            self._is_downloaded = self.checkpoint_path.exists()
        return self._is_downloaded

    def download(self) -> bool:
        if self.is_downloaded():
            return True
        self.CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)
        logger.info(f"[SharpModel] Downloading checkpoint...")
        try:
            if self._command_exists("wget"):
                subprocess.run(["wget", "-q", "-O", str(self.checkpoint_path), self.CHECKPOINT_URL], check=True)
            elif self._command_exists("curl"):
                subprocess.run(["curl", "-L", "-o", str(self.checkpoint_path), self.CHECKPOINT_URL], check=True)
            else:
                raise RuntimeError("No downloader available")
            self._is_downloaded = True
            return True
        except Exception as e:
            if self.checkpoint_path.exists(): self.checkpoint_path.unlink()
            raise RuntimeError(f"Download failed: {e}")

    def load_model(self):
        """Load the model into memory."""
        self.last_used = time.time()
        if self._model is not None: return

        if not SHARP_AVAILABLE:
            raise ImportError(f"ml-sharp library not found or incomplete. Error: {SHARP_IMPORT_ERROR}")

        if not self.is_downloaded():
            self.download()

        logger.info(f"[SharpModel] Loading model into RAM ({self.device})...")
        try:
            # 1. Create architecture
            params = PredictorParams()
            model = create_predictor(params)
            
            # 2. Load weights
            state_dict = torch.load(self.checkpoint_path, map_location=self.device)
            model.load_state_dict(state_dict)
            model.to(self.device)
            model.eval()
            
            self._model = model
            logger.info("[SharpModel] Model loaded successfully.")
            
        except Exception as e:
            logger.error(f"[SharpModel] Failed to load model: {e}")
            self._model = None
            raise e

    def unload_model(self):
        if self._model is not None:
            logger.info("[SharpModel] Unloading model...")
            del self._model
            self._model = None
            gc.collect()

    def _predict_gaussians(self, image: np.ndarray, f_px: float):
        """
        Internal method reusing logic from sharp.cli.predict.predict_image
        Re-implemented here because CLI function is not easily importable/usable.
        """
        t0 = time.time()
        device = torch.device(self.device)
        
        # 1. Prepare Image Tensor
        # sharp.cli.predict logic: float() / 255.0
        # Copy numpy array to avoid "not writable" warning
        image_copy = image.copy()
        
        image_pt = torch.from_numpy(image_copy).float().to(device) / 255.0
        if len(image_pt.shape) == 3:
            # HWC to CHW
            image_pt = image_pt.permute(2, 0, 1)
            
        _, height, width = image_pt.shape
            
        # 2. Resize
        image_resized_pt = F.interpolate(
            image_pt[None], # Add batch dim
            size=(self.INTERNAL_SHAPE[1], self.INTERNAL_SHAPE[0]),
            mode="bilinear",
            align_corners=True,
        )
        
        t1 = time.time()
        logger.info(f"[SharpModel] Preprocessing: {t1 - t0:.3f}s")

        # 3. Predict NDC
        disparity_factor = torch.tensor([f_px / width]).float().to(device)
        
        with torch.no_grad():
            gaussians_ndc = self._model(image_resized_pt, disparity_factor)
            
        t2 = time.time()
        logger.info(f"[SharpModel] Inference: {t2 - t1:.3f}s")
            
        # 4. Construct Intrinsics and Unproject
        intrinsics = torch.tensor([
            [f_px, 0, width / 2, 0],
            [0, f_px, height / 2, 0],
            [0, 0, 1, 0],
            [0, 0, 0, 1],
        ]).float().to(device)
        
        intrinsics_resized = intrinsics.clone()
        intrinsics_resized[0] *= self.INTERNAL_SHAPE[0] / width
        intrinsics_resized[1] *= self.INTERNAL_SHAPE[1] / height
        
        view_matrix = torch.eye(4).to(device)
        
        gaussians = unproject_gaussians(
            gaussians_ndc, 
            view_matrix,
            intrinsics_resized, 
            self.INTERNAL_SHAPE
        )
        
        t3 = time.time()
        logger.info(f"[SharpModel] Postprocessing: {t3 - t2:.3f}s")
        
        return gaussians

    def predict(self, input_image_path: str, output_dir: str) -> str:
        self.last_used = time.time()
        if self._model is None:
            self.load_model()
            
        logger.info(f"[SharpModel] Processing {input_image_path}...")
        try:
            # 1. Load Image using library utility (handles exif rotation, etc)
            # Returns: image (H,W,3 uint8), metadata, focal_length_px
            image, _, f_px = sharp_io.load_rgb(Path(input_image_path))
            
            # 2. Run Inference
            gaussians = self._predict_gaussians(image, f_px)
            
            # 3. Save Output
            output_path = Path(output_dir) / (Path(input_image_path).stem + ".ply")
            output_dir_path = Path(output_dir)
            output_dir_path.mkdir(parents=True, exist_ok=True)
            
            # Get original image dims for saving
            h, w, _ = image.shape
            
            t_start_save = time.time()
            save_ply(gaussians, f_px, (h, w), output_path)
            t_end_save = time.time()
            logger.info(f"[SharpModel] Save PLY: {t_end_save - t_start_save:.3f}s")
            
            logger.info(f"[SharpModel] Saved to {output_path}")
            return str(output_path)
            
        except Exception as e:
            logger.error(f"[SharpModel] Prediction failed: {e}")
            import traceback
            logger.error(traceback.format_exc())
            raise RuntimeError(f"Splat generation failed: {e}")

    def get_status(self) -> dict:
        return {
            "key": "sharp",
            "is_loaded": self._model is not None,
            "is_downloaded": self.is_downloaded(),
            "device": self.device,
            "memory_usage": "High (RAM)" if self._model else "0GB"
        }

    def _command_exists(self, cmd: str) -> bool:
        import shutil
        return shutil.which(cmd) is not None

# Singleton instance
sharp_model = SharpModel()
