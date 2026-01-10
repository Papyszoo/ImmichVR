"""ImmichVR AI Service - Depth Converter with Depth Anything V2."""

import io
import os
import logging
import subprocess
import tempfile
import zipfile
import shutil
from pathlib import Path
from flask import Flask, jsonify, request, send_file
from PIL import Image
import numpy as np
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
            "process_video_depth": "/api/video/depth (POST) [EXPERIMENTAL]"
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


if __name__ == "__main__":
    # Initialize model on startup
    if not initialize_model():
        logger.warning("Model initialization failed, service starting without model")
    
    port = int(os.environ.get("AI_SERVICE_PORT", 5000))
    app.run(host="0.0.0.0", port=port)
