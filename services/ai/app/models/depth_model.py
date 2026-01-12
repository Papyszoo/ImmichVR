import logging
import torch
from transformers import pipeline
from ..config import Config

logger = logging.getLogger(__name__)

class DepthModel:
    def __init__(self):
        self._pipeline = None
        self.device = -1

    def initialize(self):
        """Initialize the Depth Anything V2 model."""
        try:
            logger.info("Initializing Depth Anything V2 model...")
            
            # Use CPU by default, GPU if available
            self.device = 0 if torch.cuda.is_available() else -1
            device_name = "GPU" if self.device == 0 else "CPU"
            logger.info(f"Using device: {device_name}")
            
            # Initialize depth estimation pipeline with Depth Anything V2
            self._pipeline = pipeline(
                task="depth-estimation",
                model=Config.MODEL_ID,
                device=self.device
            )
            
            logger.info("Model initialized successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize model: {str(e)}")
            return False

    def predict(self, image):
        """
        Generate depth prediction for an image.
        Args:
            image: PIL Image
        Returns:
            dict: Result containing 'depth' map (PIL Image)
        """
        if self._pipeline is None:
            raise RuntimeError("Model not initialized")
        return self._pipeline(image)

    @property
    def is_loaded(self):
        return self._pipeline is not None

# Singleton instance
model = DepthModel()
