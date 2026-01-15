import os

class Config:
    """Base configuration."""
    # Service Config
    PORT = int(os.environ.get("AI_SERVICE_PORT", 5000))
    
    # Device Config
    DEVICE = "cuda" if os.environ.get("CUDA_VISIBLE_DEVICES") else "cpu"
    
    # Model Registry
    AVAILABLE_MODELS = {
        "small": {
            "id": "depth-anything/Depth-Anything-V2-Small-hf",
            "name": "Small",
            "params": "25M",
            "memory": "~100MB",
            "description": "Fast, good for previews",
        },
        "base": {
            "id": "depth-anything/Depth-Anything-V2-Base-hf",
            "name": "Base",
            "params": "97M",
            "memory": "~400MB",
            "description": "Balanced quality/speed",
        },
        "large": {
            "id": "depth-anything/Depth-Anything-V2-Large-hf",
            "name": "Large",
            "params": "335M",
            "memory": "~1.3GB",
            "description": "Best detail (hair, fences)",
        },
    }
    
    # Default model (environment variable or fallback to small for dev)
    DEFAULT_MODEL = os.environ.get("DEPTH_MODEL", "small")
    
    # Processing Limits
    MAX_VIDEO_FRAMES = 100
    MAX_VIDEO_DURATION = 300  # seconds
    BATCH_SIZE = 10
    
    # Paths
    TEMP_DIR = os.environ.get("TEMP_DIR", "/tmp/immichvr-ai")
    MODEL_CACHE_DIR = os.environ.get("MODEL_CACHE_DIR", "/app/models")
