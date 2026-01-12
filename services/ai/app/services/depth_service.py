import numpy as np
import cv2
from PIL import Image
from ..models.depth_model import model

def process_frame_depth(frame: np.ndarray) -> np.ndarray:
    """
    Process a single frame through the depth estimation model.
    Args:
        frame: Frame as numpy array (BGR format from cv2)
    Returns:
        Depth map as numpy array (0-255 grayscale)
    """
    # Convert BGR to RGB for PIL
    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    image = Image.fromarray(frame_rgb)
    
    # Generate depth map
    result = model.predict(image)
    depth_map = result["depth"]
    
    # Convert to numpy and normalize to 0-255
    depth_array = np.array(depth_map)
    depth_min = depth_array.min()
    depth_max = depth_array.max()
    
    # Handle uniform depth
    if depth_max - depth_min < 1e-10:
        return np.full_like(depth_array, 128, dtype=np.uint8)
    
    depth_normalized = ((depth_array - depth_min) / (depth_max - depth_min) * 255).astype(np.uint8)
    return depth_normalized
