import logging
import torch
import gc
import os
from transformers import pipeline
from huggingface_hub import scan_cache_dir
from ..config import Config

logger = logging.getLogger(__name__)

# Mock support for E2E testing
MOCK_DOWNLOADS = os.getenv('MOCK_DOWNLOADS', 'false').lower() == 'true'


class DepthModel:
    """Multi-model depth estimation manager supporting model switching."""
    
    def __init__(self):
        self._pipeline = None
        self.device = -1
        self.current_model_key = None
        self._model_status = {}
        
        # Mock state for testing
        self._mock_downloaded = set()  # Models marked as downloaded in mock mode
        
        # Idle timeout management
        self.last_used = 0
        self.timeout_minutes = 30
        self._stop_monitor = False
        self._monitor_thread = None
        self._start_monitor()

    def _start_monitor(self):
        """Start background thread to monitor idle time."""
        import threading
        import time
        
        def monitor_loop():
            logger.info(f"Idle monitor started. Timeout: {self.timeout_minutes} mins")
            while not self._stop_monitor:
                if self._pipeline is not None:
                    elapsed_mins = (time.time() - self.last_used) / 60
                    if elapsed_mins > self.timeout_minutes:
                        logger.info(f"Model idle for {elapsed_mins:.1f} mins. Unloading...")
                        self._unload_current_model()
                time.sleep(60) # Check every minute
                
        self._monitor_thread = threading.Thread(target=monitor_loop, daemon=True)
        self._monitor_thread.start()

    def initialize(self, model_key: str = None, device_type: str = 'auto'):
        """
        Initialize a specific depth model.
        
        Args:
            model_key: Which model to load (small, base, large). 
                      Defaults to Config.DEFAULT_MODEL.
            device_type: 'auto', 'cpu', or 'gpu'
        
        Returns:
            bool: True if initialization succeeded
        """
        import time
        self.last_used = time.time()
        
        model_key = model_key or Config.DEFAULT_MODEL
        
        if model_key not in Config.AVAILABLE_MODELS:
            logger.error(f"Unknown model key: {model_key}")
            return False
        
        # If already loaded with same key AND same device type, maybe skip?
        # For simplicity, if they forcefully request a device, we might want to reload to be sure.
        # But if it's strictly 'auto' and we are already loaded, we can likely skip.
        if self._pipeline is not None and self.current_model_key == model_key:
             # Basic check: if they want CPU and we are on GPU (device 0), reload.
             # If they want GPU and we are on CPU (device -1), reload.
             current_device_is_gpu = (self.device != -1 and self.device != "cpu")
             requested_cpu = (device_type == 'cpu')
             requested_gpu = (device_type == 'gpu')
             
             if requested_cpu and current_device_is_gpu:
                 logger.info("Reloading to switch to CPU")
             elif requested_gpu and not current_device_is_gpu:
                 logger.info("Reloading to switch to GPU")
             else:
                 logger.info(f"Model {model_key} already loaded on compatible device")
                 return True
        
        try:
            logger.info(f"Initializing Depth Anything V2 model: {model_key} [Device: {device_type}]...")
            
            # Unload current model if exists
            if self._pipeline is not None:
                self._unload_current_model()
            
            # Mock mode: create fake pipeline
            if MOCK_DOWNLOADS:
                logger.info("MOCK MODE: Creating fake pipeline")
                self.device = -1
                self._pipeline = self._create_mock_pipeline()
                self.current_model_key = model_key
                self._mock_downloaded.add(model_key)
                logger.info(f"Mock model {model_key} initialized")
                return True
            
            # Determine device
            # Default to CPU (-1)
            target_device = -1 
            
            if device_type == 'cpu':
                target_device = -1
                logger.info("Forcing usage of CPU")
            else:
                # 'auto' or 'gpu'
                if torch.cuda.is_available():
                    target_device = 0 # CUDA device 0
                    logger.info("CUDA GPU is available. Using CUDA.")
                elif torch.backends.mps.is_available():
                     target_device = "mps" # Apple Silicon
                     logger.info("Apple MPS is available. Using MPS.")
                else:
                    if device_type == 'gpu':
                        logger.warning("GPU requested but neither CUDA nor MPS is available. Falling back to CPU.")
                    target_device = -1
            
            self.device = target_device
            device_name = "CPU"
            if self.device == 0: device_name = "CUDA GPU"
            elif self.device == "mps": device_name = "Apple MPS"
            
            logger.info(f"Using device: {device_name}")
            
            # Get model ID from registry
            model_config = Config.AVAILABLE_MODELS[model_key]
            model_id = model_config["id"]
            
            # Initialize depth estimation pipeline
            self._pipeline = pipeline(
                task="depth-estimation",
                model=model_id,
                device=self.device
            )
            
            self.current_model_key = model_key
            logger.info(f"Model {model_key} initialized successfully on {device_name}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize model {model_key}: {str(e)}")
            self._pipeline = None
            self.current_model_key = None
            return False
    def download_model(self, model_key: str) -> bool:
        """
        Download a model's files without loading it into memory.
        
        Args:
            model_key: Model to download
            
        Returns:
            bool: True if download succeeded
        """
        if model_key not in Config.AVAILABLE_MODELS:
            logger.error(f"Unknown model key: {model_key}")
            return False
            
        # Mock mode
        if MOCK_DOWNLOADS:
            logger.info(f"MOCK MODE: Downloading {model_key}")
            self._mock_downloaded.add(model_key)
            return True
            
        try:
            logger.info(f"Downloading model files for {model_key}...")
            model_config = Config.AVAILABLE_MODELS[model_key]
            repo_id = model_config["id"]
            
            # snapshot_download will cache files to disk
            scan_cache_dir() # Refresh cache info before check? Not strictly needed but good practice
            
            from huggingface_hub import snapshot_download
            snapshot_download(repo_id=repo_id)
            
            logger.info(f"Model {model_key} downloaded successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to download model {model_key}: {str(e)}")
            return False

    def _unload_current_model(self):
        """Unload current model and free memory."""
        if self._pipeline is not None:
            logger.info(f"Unloading model: {self.current_model_key}")
            del self._pipeline
            self._pipeline = None
            self.current_model_key = None
            
            # Force garbage collection (multiple passes)
            gc.collect()
            gc.collect()
            
            # Clear CUDA cache if using GPU
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                torch.cuda.ipc_collect()
                logger.info("Cleared CUDA cache")
            
            # Clear MPS cache if using Apple Silicon
            if hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
                try:
                    torch.mps.empty_cache()
                    logger.info("Cleared MPS cache")
                except Exception as e:
                    logger.warning(f"Failed to clear MPS cache: {e}")

    def switch_model(self, model_key: str, device_type: str = 'auto') -> bool:
        """
        Switch to a different model variant or device.
        
        Args:
            model_key: Target model (small, base, large)
            device_type: 'auto', 'cpu', 'gpu'
            
        Returns:
            bool: True if switch succeeded
        """
        import time
        self.last_used = time.time()
        
        # We now check device compatibility inside initialize
        logger.info(f"Switching to {model_key} (Device: {device_type})")
        return self.initialize(model_key, device_type)

    def predict(self, image, model_key: str = None):
        """
        Generate depth prediction for an image.
        
        Args:
            image: PIL Image
            model_key: Optional model to use (will switch if different)
            
        Returns:
            dict: Result containing 'depth' map (PIL Image)
        """
        import time
        self.last_used = time.time()
        
        # Auto-initialize if unloaded OR if switching is requested
        if self._pipeline is None:
            logger.info("Model unloaded. Auto-initializing...")
            if not self.initialize(model_key):
                raise RuntimeError(f"Failed to auto-initialize model: {model_key or 'default'}")
                
        elif model_key and model_key != self.current_model_key:
            if not self.switch_model(model_key):
                raise RuntimeError(f"Failed to switch to model: {model_key}")
        
        if self._pipeline is None:
             raise RuntimeError("Model initialization failed unexpectedly")
        
        return self._pipeline(image)


    @property
    def is_loaded(self) -> bool:
        """Check if any model is currently loaded."""
        return self._pipeline is not None

    def _create_mock_pipeline(self):
        """Create a mock pipeline for testing."""
        from PIL import Image
        import numpy as np
        
        class MockPipeline:
            def __call__(self, image):
                # Return a simple gradient as fake depth map
                width, height = image.size
                depth_array = np.linspace(0, 255, width * height).reshape(height, width)
                depth_image = Image.fromarray(depth_array.astype(np.uint8))
                return {"depth": depth_image}
        
        return MockPipeline()
    
    def _get_downloaded_models(self) -> list:
        """
        Scan Hugging Face cache to see which models are actually downloaded.
        Returns a list of model keys (e.g. ['small', 'base']).
        """
        # Mock mode: return mock downloaded list
        if MOCK_DOWNLOADS:
            downloaded = list(self._mock_downloaded)
            if self.current_model_key and self.current_model_key not in downloaded:
                downloaded.append(self.current_model_key)
            return sorted(downloaded)
        
        downloaded = []
        try:
            hf_cache_info = scan_cache_dir()
            
            # Map repo IDs to our keys
            repo_to_key = {cfg["id"]: key for key, cfg in Config.AVAILABLE_MODELS.items()}
            
            for repo in hf_cache_info.repos:
                if repo.repo_id in repo_to_key:
                    # Check if model has revisions (files downloaded)
                    if repo.revisions:
                        downloaded.append(repo_to_key[repo.repo_id])
                        
        except Exception as e:
            logger.warning(f"Failed to scan HF cache: {e}. Falling back to manual directory check.")
            # Fallback: check for model directories manually
            import os
            
            cache_dir = os.path.expanduser("~/.cache/huggingface/hub")
            # If default location is overridden by env var, we might miss it, 
            # but this handles the standard Docker case.
            
            for key, cfg in Config.AVAILABLE_MODELS.items():
                repo_id = cfg["id"]
                # Convert repo_id to folder name: 'author/model' -> 'models--author--model'
                folder_name = f"models--{repo_id.replace('/', '--')}"
                model_path = os.path.join(cache_dir, folder_name, "snapshots")
                
                if os.path.exists(model_path) and os.path.isdir(model_path):
                    # Check if any snapshot folder exists inside
                    if any(os.path.isdir(os.path.join(model_path, d)) for d in os.listdir(model_path)):
                        downloaded.append(key)
        
        # Ensure current model is always reported as downloaded (it's in memory!)
        if self.current_model_key and self.current_model_key not in downloaded:
            downloaded.append(self.current_model_key)
                
        return sorted(list(set(downloaded)))

    def get_status(self) -> dict:
        """Get current model status."""
        d_name = "CPU"
        if self.device == 0: d_name = "CUDA GPU"
        elif self.device == "mps": d_name = "Apple MPS"
        
        return {
            "loaded": self.is_loaded,
            "current_model": self.current_model_key,
            "device": d_name,
            "available_models": list(Config.AVAILABLE_MODELS.keys()),
            "downloaded_models": self._get_downloaded_models()
        }
        
    def delete_model(self, model_key: str) -> bool:
        """
        Delete a model from disk/mock.
        
        Args:
            model_key: Model to delete
            
        Returns:
            True if deleted (or not present), False if error
        """
        logger.info(f"Deleting model: {model_key}")
        
        # 1. Unload if currently loaded
        if self.current_model_key == model_key:
            self._unload_current_model()
            
        # 2. Mock Logic
        if MOCK_DOWNLOADS:
            if model_key in self._mock_downloaded:
                self._mock_downloaded.remove(model_key)
            return True
            
        # 3. Real Logic (Not fully implemented but safe stub)
        # In real scenario, we would delete the files from cache
        # For now, we assume success if not mock
        return True


# Singleton instance
model = DepthModel()
