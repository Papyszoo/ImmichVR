import os

class Config:
    """Base configuration."""
    # Service Config
    PORT = int(os.environ.get("AI_SERVICE_PORT", 5000))
    
    # Model Config
    MODEL_ID = "depth-anything/Depth-Anything-V2-Large-hf"
    DEVICE = "cuda" if os.environ.get("CUDA_VISIBLE_DEVICES") else "cpu"
    
    # Processing Limits
    MAX_VIDEO_FRAMES = 100
    MAX_VIDEO_DURATION = 300  # seconds
    BATCH_SIZE = 10
    
    # Paths (if needed)
    TEMP_DIR = os.environ.get("TEMP_DIR", "/tmp/immichvr-ai")
