import numpy as np
import cv2

def generate_stereo_pair_vectorized(frame: np.ndarray, depth_map: np.ndarray, divergence: float = 2.0):
    """
    Generate left and right eye views from a frame and its depth map.
    Uses NumPy vectorized operations for efficient processing.
    """
    height, width = frame.shape[:2]
    
    # Normalize depth map to 0-1 range
    depth_normalized = depth_map.astype(np.float32) / 255.0
    
    # Calculate displacement based on depth
    # Closer objects (darker/lower values) should have more displacement
    # Invert depth so closer = more displacement
    displacement = (1.0 - depth_normalized) * divergence
    
    # Create coordinate grids using meshgrid
    y_coords, x_coords = np.meshgrid(np.arange(height), np.arange(width), indexing='ij')
    
    # Calculate new x coordinates for left and right eyes
    x_left = (x_coords + displacement).astype(np.float32)
    x_right = (x_coords - displacement).astype(np.float32)
    
    # Use cv2.remap for efficient image warping
    map_y = y_coords.astype(np.float32)
    
    # Generate left eye view
    left_eye = cv2.remap(frame, x_left, map_y, cv2.INTER_LINEAR,
                         borderMode=cv2.BORDER_REFLECT_101)
    
    # Generate right eye view
    right_eye = cv2.remap(frame, x_right, map_y, cv2.INTER_LINEAR,
                          borderMode=cv2.BORDER_REFLECT_101)
    
    return left_eye, right_eye


def compose_sbs_frame(left_eye: np.ndarray, right_eye: np.ndarray, sbs_format: str = 'SBS_FULL'):
    """
    Compose a Side-by-Side frame from left and right eye views.
    """
    if sbs_format == 'SBS_HALF':
        # Scale each eye to half width
        height = left_eye.shape[0]
        half_width = left_eye.shape[1] // 2
        left_scaled = cv2.resize(left_eye, (half_width, height), interpolation=cv2.INTER_LINEAR)
        right_scaled = cv2.resize(right_eye, (half_width, height), interpolation=cv2.INTER_LINEAR)
        return np.hstack((left_scaled, right_scaled))
    else:
        # SBS_FULL: Concatenate at full resolution (double width)
        return np.hstack((left_eye, right_eye))
