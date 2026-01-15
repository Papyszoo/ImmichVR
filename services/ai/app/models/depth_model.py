import logging
import torch
import gc
from transformers import pipeline
from huggingface_hub import scan_cache_dir
from ..config import Config

logger = logging.getLogger(__name__)


class DepthModel:
    """Multi-model depth estimation manager supporting model switching."""
    
    def __init__(self):
        self._pipeline = None
        self.device = -1
        self.current_model_key = None
        self._model_status = {}
        
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

    def initialize(self, model_key: str = None):
        """
        Initialize a specific depth model.
        
        Args:
            model_key: Which model to load (small, base, large). 
                      Defaults to Config.DEFAULT_MODEL.
        
        Returns:
            bool: True if initialization succeeded
        """
        import time
        self.last_used = time.time()
        
        model_key = model_key or Config.DEFAULT_MODEL
        
        if model_key not in Config.AVAILABLE_MODELS:
            logger.error(f"Unknown model key: {model_key}")
            return False
        
        # If already loaded, skip
        if self._pipeline is not None and self.current_model_key == model_key:
            logger.info(f"Model {model_key} already loaded")
            return True
        
        try:
            logger.info(f"Initializing Depth Anything V2 model: {model_key}...")
            
            # Unload current model if exists
            if self._pipeline is not None:
                self._unload_current_model()
            
            # Determine device
            self.device = 0 if torch.cuda.is_available() else -1
            device_name = "GPU" if self.device == 0 else "CPU"
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
            logger.info(f"Model {model_key} initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize model {model_key}: {str(e)}")
            self._pipeline = None
            self.current_model_key = None
            return False

    def _unload_current_model(self):
        """Unload current model and free memory."""
        if self._pipeline is not None:
            logger.info(f"Unloading model: {self.current_model_key}")
            del self._pipeline
            self._pipeline = None
            self.current_model_key = None
            
            # Force garbage collection
            gc.collect()
            
            # Clear CUDA cache if using GPU
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                logger.info("Cleared CUDA cache")

    def switch_model(self, model_key: str) -> bool:
        """
        Switch to a different model variant.
        
        Args:
            model_key: Target model (small, base, large)
            
        Returns:
            bool: True if switch succeeded
        """
        import time
        self.last_used = time.time()
        
        if model_key == self.current_model_key:
            logger.info(f"Model {model_key} already active")
            return True
        
        logger.info(f"Switching from {self.current_model_key} to {model_key}")
        return self.initialize(model_key)

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

    def _get_downloaded_models(self) -> list:
        """
        Scan Hugging Face cache to see which models are actually downloaded.
        Returns a list of model keys (e.g. ['small', 'base']).
        """
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
        return {
            "loaded": self.is_loaded,
            "current_model": self.current_model_key,
            "device": "GPU" if self.device == 0 else "CPU",
            "available_models": list(Config.AVAILABLE_MODELS.keys()),
            "downloaded_models": self._get_downloaded_models()
        }


# Singleton instance
model = DepthModel()
