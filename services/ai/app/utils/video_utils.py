import subprocess
import json
import logging

logger = logging.getLogger(__name__)

def get_video_fps(video_path):
    """Get the frame rate of a video file using FFprobe."""
    cmd = [
        'ffprobe', '-v', 'error',
        '-select_streams', 'v:0',
        '-show_entries', 'stream=r_frame_rate',
        '-of', 'json',
        video_path
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            return 30.0  # Default FPS if detection fails
    
        data = json.loads(result.stdout)
        fps_str = data['streams'][0]['r_frame_rate']
        num, denom = map(int, fps_str.split('/'))
        return num / denom if denom != 0 else 30.0
    except (KeyError, IndexError, ValueError, ZeroDivisionError, Exception) as e:
        logger.warning(f"Failed to detect FPS: {e}, using default 30.0")
        return 30.0
