"""ImmichVR AI Service - Depth Converter with Depth Anything V2."""

import io
import os
import logging
import subprocess
import tempfile
import zipfile
import shutil
import json
from pathlib import Path
from flask import Flask, jsonify, request, send_file
from PIL import Image
import numpy as np
import cv2
import torch
from transformers import pipeline

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Global variable to hold the depth estimation pipeline
depth_estimator = None


def initialize_model():
    """Initialize the Depth Anything V2 model."""
    global depth_estimator
    try:
        logger.info("Initializing Depth Anything V2 model...")
        
        # Use CPU by default, GPU if available
        device = 0 if torch.cuda.is_available() else -1
        device_name = "GPU" if device == 0 else "CPU"
        logger.info(f"Using device: {device_name}")
        
        # Initialize depth estimation pipeline with Depth Anything V2
        # Using the small model for faster inference and lower memory usage
        model_id = "depth-anything/Depth-Anything-V2-Small-hf"
        depth_estimator = pipeline(
            task="depth-estimation",
            model=model_id,
            device=device
        )
        
        logger.info("Model initialized successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to initialize model: {str(e)}")
        return False


def generate_stereo_pair_vectorized(frame: np.ndarray, depth_map: np.ndarray,
                                    divergence: float = 2.0) -> tuple:
    """
    Generate left and right eye views from a frame and its depth map.
    
    Uses NumPy vectorized operations for efficient processing.
    No Python for-loops over pixels are used.
    
    Args:
        frame: Original RGB frame as numpy array (H, W, 3)
        depth_map: Depth map as numpy array (H, W), values 0-255
        divergence: Strength of the 3D effect (simulated IPD)
    
    Returns:
        Tuple of (left_eye_view, right_eye_view) as numpy arrays
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
    # Left eye: shift pixels to the right (positive displacement)
    # Right eye: shift pixels to the left (negative displacement)
    x_left = (x_coords + displacement).astype(np.float32)
    x_right = (x_coords - displacement).astype(np.float32)
    
    # Use cv2.remap for efficient image warping
    # Map type 0 is the x map, map type 1 is the y map
    map_y = y_coords.astype(np.float32)
    
    # Generate left eye view
    left_eye = cv2.remap(frame, x_left, map_y, cv2.INTER_LINEAR,
                         borderMode=cv2.BORDER_REFLECT_101)
    
    # Generate right eye view
    right_eye = cv2.remap(frame, x_right, map_y, cv2.INTER_LINEAR,
                          borderMode=cv2.BORDER_REFLECT_101)
    
    return left_eye, right_eye


def compose_sbs_frame(left_eye: np.ndarray, right_eye: np.ndarray,
                      sbs_format: str = 'SBS_FULL') -> np.ndarray:
    """
    Compose a Side-by-Side frame from left and right eye views.
    
    Args:
        left_eye: Left eye view as numpy array
        right_eye: Right eye view as numpy array
        sbs_format: 'SBS_FULL' (double width) or 'SBS_HALF' (original width, half resolution per eye)
    
    Returns:
        Side-by-side composed frame
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


def get_video_fps(video_path: str) -> float:
    """Get the frame rate of a video file using FFprobe."""
    cmd = [
        'ffprobe', '-v', 'error',
        '-select_streams', 'v:0',
        '-show_entries', 'stream=r_frame_rate',
        '-of', 'json',
        video_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        return 30.0  # Default FPS if detection fails
    
    try:
        data = json.loads(result.stdout)
        fps_str = data['streams'][0]['r_frame_rate']
        num, denom = map(int, fps_str.split('/'))
        return num / denom if denom != 0 else 30.0
    except (KeyError, IndexError, ValueError, ZeroDivisionError):
        return 30.0


def process_frame_depth(frame: np.ndarray) -> np.ndarray:
    """
    Process a single frame through the depth estimation model.
    
    Args:
        frame: Frame as numpy array (BGR format from cv2)
    
    Returns:
        Depth map as numpy array (0-255 grayscale)
    """
    global depth_estimator
    
    # Convert BGR to RGB for PIL
    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    image = Image.fromarray(frame_rgb)
    
    # Generate depth map
    result = depth_estimator(image)
    depth_map = result["depth"]
    
    # Convert to numpy and normalize to 0-255
    depth_array = np.array(depth_map)
    depth_min = depth_array.min()
    depth_max = depth_array.max()
    
    if depth_max - depth_min < 1e-10:
        return np.full_like(depth_array, 128, dtype=np.uint8)
    
    depth_normalized = ((depth_array - depth_min) / (depth_max - depth_min) * 255).astype(np.uint8)
    return depth_normalized


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint."""
    model_status = "loaded" if depth_estimator is not None else "not_loaded"
    return jsonify({
        "status": "healthy",
        "service": "ai",
        "model": "Depth-Anything-V2",
        "model_status": model_status
    })


@app.route("/", methods=["GET"])
def index():
    """Root endpoint."""
    return jsonify({
        "message": "ImmichVR AI Service",
        "version": "1.0.0",
        "model": "Depth Anything V2",
        "endpoints": {
            "health": "/health",
            "process_depth": "/api/depth (POST)",
            "extract_video_frames": "/api/video/frames (POST) [EXPERIMENTAL]",
            "process_video_depth": "/api/video/depth (POST) [EXPERIMENTAL]",
            "process_video_sbs": "/api/video/sbs (POST) [EXPERIMENTAL]"
        }
    })


@app.route("/api/depth", methods=["POST"])
def process_depth():
    """
    Process an image and return its depth map.
    
    Expected input: multipart/form-data with 'image' file
    Returns: depth map as PNG image
    """
    if depth_estimator is None:
        return jsonify({
            "error": "Model not initialized",
            "message": "Depth estimation model is not available"
        }), 503
    
    # Check if image file is present
    if 'image' not in request.files:
        return jsonify({
            "error": "No image provided",
            "message": "Please upload an image file with key 'image'"
        }), 400
    
    file = request.files['image']
    
    if file.filename == '':
        return jsonify({
            "error": "Empty filename",
            "message": "No file selected"
        }), 400
    
    try:
        # Read and process the image
        image_bytes = file.read()
        image = Image.open(io.BytesIO(image_bytes))
        
        # Convert to RGB if needed
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        logger.info(f"Processing image: {file.filename}, size: {image.size}")
        
        # Generate depth map
        result = depth_estimator(image)
        depth_map = result["depth"]
        
        # Convert depth map to numpy array and normalize
        depth_array = np.array(depth_map)
        depth_min = depth_array.min()
        depth_max = depth_array.max()
        
        # Handle edge case where depth is uniform (avoid division by zero)
        if depth_max - depth_min < 1e-10:
            depth_normalized = np.full_like(depth_array, 128, dtype=np.uint8)
        else:
            depth_normalized = ((depth_array - depth_min) / 
                              (depth_max - depth_min) * 255).astype(np.uint8)
        
        # Convert back to PIL Image
        depth_image = Image.fromarray(depth_normalized)
        
        # Save to bytes buffer
        img_io = io.BytesIO()
        depth_image.save(img_io, 'PNG')
        img_io.seek(0)
        
        logger.info(f"Successfully processed image: {file.filename}")
        
        return send_file(
            img_io,
            mimetype='image/png',
            as_attachment=True,
            download_name=f"depth_{file.filename.rsplit('.', 1)[0]}.png"
        )
        
    except Exception as e:
        logger.error(f"Error processing image: {str(e)}")
        return jsonify({
            "error": "Processing failed",
            "message": str(e)
        }), 500


@app.route("/api/video/frames", methods=["POST"])
def extract_video_frames():
    """
    Extract frames from a video file at specified intervals.
    [EXPERIMENTAL FEATURE]
    
    Expected input: multipart/form-data with 'video' file
    Query parameters:
      - fps: Frames per second to extract (default: 1, max: 30)
      - max_frames: Maximum number of frames to extract (default: 30, max: 100)
      - method: 'interval' (time-based) or 'keyframes' (default: 'interval')
    
    Returns: JSON with frame count and metadata
    """
    if depth_estimator is None:
        return jsonify({
            "error": "Model not initialized",
            "message": "Depth estimation model is not available"
        }), 503
    
    # Check if video file is present
    if 'video' not in request.files:
        return jsonify({
            "error": "No video provided",
            "message": "Please upload a video file with key 'video'"
        }), 400
    
    file = request.files['video']
    
    if file.filename == '':
        return jsonify({
            "error": "Empty filename",
            "message": "No file selected"
        }), 400
    
    # Parse parameters
    fps = min(float(request.args.get('fps', 1)), 30)
    max_frames = min(int(request.args.get('max_frames', 30)), 100)
    method = request.args.get('method', 'interval')
    
    temp_video_path = None
    frames_dir = None
    
    try:
        # Save uploaded video to temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as temp_video:
            file.save(temp_video)
            temp_video_path = temp_video.name
        
        # Create temp directory for frames
        frames_dir = tempfile.mkdtemp()
        
        # Extract frames using FFmpeg
        if method == 'keyframes':
            # Extract keyframes only
            cmd = [
                'ffmpeg', '-i', temp_video_path,
                '-vf', f'select=eq(pict_type\\,I),scale=-1:480',
                '-vsync', 'vfr',
                '-frames:v', str(max_frames),
                f'{frames_dir}/frame_%04d.png'
            ]
        else:
            # Extract frames at specified FPS
            cmd = [
                'ffmpeg', '-i', temp_video_path,
                '-vf', f'fps={fps},scale=-1:480',
                '-frames:v', str(max_frames),
                f'{frames_dir}/frame_%04d.png'
            ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        
        if result.returncode != 0:
            raise Exception(f"FFmpeg error: {result.stderr}")
        
        # Count extracted frames
        frame_files = sorted(Path(frames_dir).glob('frame_*.png'))
        frame_count = len(frame_files)
        
        logger.info(f"Extracted {frame_count} frames from {file.filename} using method={method}, fps={fps}")
        
        return jsonify({
            "success": True,
            "filename": file.filename,
            "method": method,
            "fps": fps if method == 'interval' else None,
            "frame_count": frame_count,
            "max_frames": max_frames,
            "temp_frames_dir": frames_dir,
            "message": "Frames extracted successfully. Use /api/video/depth to process depth maps."
        })
        
    except subprocess.TimeoutExpired:
        return jsonify({
            "error": "Processing timeout",
            "message": "Video processing took too long"
        }), 504
    except Exception as e:
        logger.error(f"Error extracting video frames: {str(e)}")
        # Cleanup on error
        if frames_dir and os.path.exists(frames_dir):
            shutil.rmtree(frames_dir, ignore_errors=True)
        return jsonify({
            "error": "Frame extraction failed",
            "message": str(e)
        }), 500
    finally:
        # Clean up temp video file
        if temp_video_path and os.path.exists(temp_video_path):
            os.unlink(temp_video_path)


@app.route("/api/video/depth", methods=["POST"])
def process_video_depth():
    """
    Process video frames and generate depth maps.
    [EXPERIMENTAL FEATURE]
    
    Expected input: multipart/form-data with 'video' file
    Query parameters:
      - fps: Frames per second to extract (default: 1, max: 30)
      - max_frames: Maximum number of frames to extract (default: 30, max: 100)
      - method: 'interval' (time-based) or 'keyframes' (default: 'interval')
      - output_format: 'zip' (default) or 'individual'
    
    Returns: ZIP file containing depth map frames
    """
    if depth_estimator is None:
        return jsonify({
            "error": "Model not initialized",
            "message": "Depth estimation model is not available"
        }), 503
    
    # Check if video file is present
    if 'video' not in request.files:
        return jsonify({
            "error": "No video provided",
            "message": "Please upload a video file with key 'video'"
        }), 400
    
    file = request.files['video']
    
    if file.filename == '':
        return jsonify({
            "error": "Empty filename",
            "message": "No file selected"
        }), 400
    
    # Parse parameters
    fps = min(float(request.args.get('fps', 1)), 30)
    max_frames = min(int(request.args.get('max_frames', 30)), 100)
    method = request.args.get('method', 'interval')
    output_format = request.args.get('output_format', 'zip')
    
    temp_video_path = None
    frames_dir = None
    depth_maps_dir = None
    
    try:
        # Save uploaded video to temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as temp_video:
            file.save(temp_video)
            temp_video_path = temp_video.name
        
        # Create temp directories
        frames_dir = tempfile.mkdtemp()
        depth_maps_dir = tempfile.mkdtemp()
        
        # Extract frames using FFmpeg
        if method == 'keyframes':
            cmd = [
                'ffmpeg', '-i', temp_video_path,
                '-vf', f'select=eq(pict_type\\,I),scale=-1:480',
                '-vsync', 'vfr',
                '-frames:v', str(max_frames),
                f'{frames_dir}/frame_%04d.png'
            ]
        else:
            cmd = [
                'ffmpeg', '-i', temp_video_path,
                '-vf', f'fps={fps},scale=-1:480',
                '-frames:v', str(max_frames),
                f'{frames_dir}/frame_%04d.png'
            ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        
        if result.returncode != 0:
            raise Exception(f"FFmpeg error: {result.stderr}")
        
        # Process each frame through depth estimation
        frame_files = sorted(Path(frames_dir).glob('frame_*.png'))
        
        logger.info(f"Processing {len(frame_files)} frames for depth estimation")
        
        for i, frame_path in enumerate(frame_files):
            # Load frame
            image = Image.open(frame_path)
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Generate depth map
            result = depth_estimator(image)
            depth_map = result["depth"]
            
            # Convert to normalized uint8
            depth_array = np.array(depth_map)
            depth_min = depth_array.min()
            depth_max = depth_array.max()
            
            if depth_max - depth_min < 1e-10:
                depth_normalized = np.full_like(depth_array, 128, dtype=np.uint8)
            else:
                depth_normalized = ((depth_array - depth_min) / 
                                  (depth_max - depth_min) * 255).astype(np.uint8)
            
            # Save depth map
            depth_image = Image.fromarray(depth_normalized)
            depth_path = Path(depth_maps_dir) / f"depth_{frame_path.stem}.png"
            depth_image.save(depth_path)
            
            logger.info(f"Processed frame {i+1}/{len(frame_files)}")
        
        # Create ZIP file with depth maps
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for depth_file in sorted(Path(depth_maps_dir).glob('depth_*.png')):
                zip_file.write(depth_file, depth_file.name)
        
        zip_buffer.seek(0)
        
        logger.info(f"Successfully processed {len(frame_files)} frames from {file.filename}")
        
        # Cleanup
        if frames_dir and os.path.exists(frames_dir):
            shutil.rmtree(frames_dir, ignore_errors=True)
        if depth_maps_dir and os.path.exists(depth_maps_dir):
            shutil.rmtree(depth_maps_dir, ignore_errors=True)
        
        return send_file(
            zip_buffer,
            mimetype='application/zip',
            as_attachment=True,
            download_name=f"depth_frames_{file.filename.rsplit('.', 1)[0]}.zip"
        )
        
    except subprocess.TimeoutExpired:
        return jsonify({
            "error": "Processing timeout",
            "message": "Video processing took too long"
        }), 504
    except Exception as e:
        logger.error(f"Error processing video depth: {str(e)}")
        return jsonify({
            "error": "Video depth processing failed",
            "message": str(e)
        }), 500
    finally:
        # Clean up temp files
        if temp_video_path and os.path.exists(temp_video_path):
            os.unlink(temp_video_path)
        if frames_dir and os.path.exists(frames_dir):
            shutil.rmtree(frames_dir, ignore_errors=True)
        if depth_maps_dir and os.path.exists(depth_maps_dir):
            shutil.rmtree(depth_maps_dir, ignore_errors=True)


@app.route("/api/video/sbs", methods=["POST"])
def process_video_sbs():
    """
    Process video and generate Side-by-Side 3D video output.
    [EXPERIMENTAL FEATURE]
    
    This endpoint implements the full offline video processing pipeline:
    1. Extract all frames from the source video
    2. Generate depth maps for each frame using Depth Anything V2
    3. Generate stereo pairs using NumPy vectorized operations
    4. Compose SBS frames (left + right eye views)
    5. Encode final SBS video with H.264/HEVC and copy audio stream
    
    Expected input: multipart/form-data with 'video' file
    Query parameters:
      - divergence: Float, strength of 3D effect (default: 2.0, range: 0.5-10.0)
      - format: 'SBS_FULL' (double width) or 'SBS_HALF' (original width, default: SBS_FULL)
      - codec: 'h264' (default) or 'hevc'
      - batch_size: Number of frames to process at once for VRAM management (default: 10)
    
    Returns: SBS video file as MP4
    """
    if depth_estimator is None:
        return jsonify({
            "error": "Model not initialized",
            "message": "Depth estimation model is not available"
        }), 503
    
    # Check if video file is present
    if 'video' not in request.files:
        return jsonify({
            "error": "No video provided",
            "message": "Please upload a video file with key 'video'"
        }), 400
    
    file = request.files['video']
    
    if file.filename == '':
        return jsonify({
            "error": "Empty filename",
            "message": "No file selected"
        }), 400
    
    # Parse parameters with error handling
    try:
        divergence = min(max(float(request.args.get('divergence', 2.0)), 0.5), 10.0)
    except (ValueError, TypeError):
        divergence = 2.0
    
    sbs_format = request.args.get('format', 'SBS_FULL').upper()
    if sbs_format not in ['SBS_FULL', 'SBS_HALF']:
        sbs_format = 'SBS_FULL'
    
    codec = request.args.get('codec', 'h264').lower()
    if codec not in ['h264', 'hevc']:
        codec = 'h264'
    
    try:
        batch_size = min(max(int(request.args.get('batch_size', 10)), 1), 50)
    except (ValueError, TypeError):
        batch_size = 10
    
    temp_video_path = None
    work_dir = None
    
    try:
        # Save uploaded video to temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as temp_video:
            file.save(temp_video)
            temp_video_path = temp_video.name
        
        # Create working directory for processing
        work_dir = tempfile.mkdtemp(prefix='sbs_')
        frames_dir = os.path.join(work_dir, 'frames')
        sbs_frames_dir = os.path.join(work_dir, 'sbs_frames')
        os.makedirs(frames_dir)
        os.makedirs(sbs_frames_dir)
        
        logger.info(f"Processing video for SBS: {file.filename}, divergence={divergence}, format={sbs_format}")
        
        # Get original video FPS
        original_fps = get_video_fps(temp_video_path)
        logger.info(f"Original video FPS: {original_fps}")
        
        # Extract all frames from video at original FPS
        extract_cmd = [
            'ffmpeg', '-i', temp_video_path,
            '-qscale:v', '2',  # High quality extraction
            f'{frames_dir}/frame_%06d.png'
        ]
        
        result = subprocess.run(extract_cmd, capture_output=True, text=True, timeout=300)
        
        if result.returncode != 0:
            raise Exception(f"FFmpeg frame extraction error: {result.stderr}")
        
        # Get list of extracted frames
        frame_files = sorted(Path(frames_dir).glob('frame_*.png'))
        total_frames = len(frame_files)
        
        if total_frames == 0:
            raise Exception("No frames extracted from video")
        
        logger.info(f"Extracted {total_frames} frames, processing in batches of {batch_size}")
        
        # Process frames in batches for VRAM management
        processed_frames = 0
        for batch_start in range(0, total_frames, batch_size):
            batch_end = min(batch_start + batch_size, total_frames)
            batch_frames = frame_files[batch_start:batch_end]
            
            for frame_path in batch_frames:
                # Read frame
                frame = cv2.imread(str(frame_path))
                if frame is None:
                    logger.warning(f"Failed to read frame: {frame_path}")
                    continue
                
                # Generate depth map
                depth_map = process_frame_depth(frame)
                
                # Resize depth map to match frame dimensions if needed
                if depth_map.shape[:2] != frame.shape[:2]:
                    depth_map = cv2.resize(depth_map, (frame.shape[1], frame.shape[0]),
                                           interpolation=cv2.INTER_LINEAR)
                
                # Generate stereo pair using vectorized NumPy operations
                left_eye, right_eye = generate_stereo_pair_vectorized(frame, depth_map, divergence)
                
                # Compose SBS frame
                sbs_frame = compose_sbs_frame(left_eye, right_eye, sbs_format)
                
                # Save SBS frame
                sbs_path = os.path.join(sbs_frames_dir, frame_path.name)
                cv2.imwrite(sbs_path, sbs_frame)
                
                processed_frames += 1
            
            logger.info(f"Processed {processed_frames}/{total_frames} frames")
            
            # Clear GPU cache if available
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        
        logger.info(f"All {processed_frames} frames processed, encoding final video")
        
        # Prepare output video path
        output_filename = f"sbs_{Path(file.filename).stem}.mp4"
        output_path = os.path.join(work_dir, output_filename)
        
        # Select encoder
        if codec == 'hevc':
            video_codec = 'libx265'
            codec_opts = ['-preset', 'medium', '-crf', '23', '-tag:v', 'hvc1']
        else:
            video_codec = 'libx264'
            codec_opts = ['-preset', 'medium', '-crf', '23']
        
        # Build FFmpeg command to encode SBS video with audio from original
        encode_cmd = [
            'ffmpeg', '-y',
            '-framerate', str(original_fps),
            '-i', f'{sbs_frames_dir}/frame_%06d.png',
            '-i', temp_video_path,  # Original video for audio
            '-map', '0:v',  # Video from SBS frames
            '-map', '1:a?',  # Audio from original (optional, may not exist)
            '-c:v', video_codec,
            *codec_opts,
            '-c:a', 'copy',  # Copy audio without re-encoding
            '-pix_fmt', 'yuv420p',
            output_path
        ]
        
        result = subprocess.run(encode_cmd, capture_output=True, text=True, timeout=600)
        
        if result.returncode != 0:
            raise Exception(f"FFmpeg encoding error: {result.stderr}")
        
        # Verify output file exists
        if not os.path.exists(output_path):
            raise Exception("Output video file was not created")
        
        output_size = os.path.getsize(output_path)
        logger.info(f"Successfully created SBS video: {output_filename}, size: {output_size} bytes")
        
        # Read the output file and send it
        return send_file(
            output_path,
            mimetype='video/mp4',
            as_attachment=True,
            download_name=output_filename
        )
        
    except subprocess.TimeoutExpired:
        return jsonify({
            "error": "Processing timeout",
            "message": "Video processing took too long (frame extraction: 5 min limit, encoding: 10 min limit)"
        }), 504
    except Exception as e:
        logger.error(f"Error processing video SBS: {str(e)}")
        return jsonify({
            "error": "Video SBS processing failed",
            "message": str(e)
        }), 500
    finally:
        # Clean up temp files
        if temp_video_path and os.path.exists(temp_video_path):
            os.unlink(temp_video_path)
        if work_dir and os.path.exists(work_dir):
            shutil.rmtree(work_dir, ignore_errors=True)


if __name__ == "__main__":
    # Initialize model on startup
    if not initialize_model():
        logger.warning("Model initialization failed, service starting without model")
    
    port = int(os.environ.get("AI_SERVICE_PORT", 5000))
    app.run(host="0.0.0.0", port=port)
