"""ImmichVR AI Service - Depth Converter with Depth Anything V2."""

import io
import os
import logging
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
            "process_depth": "/api/depth (POST)"
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
        depth_normalized = ((depth_array - depth_array.min()) / 
                          (depth_array.max() - depth_array.min()) * 255).astype(np.uint8)
        
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


if __name__ == "__main__":
    # Initialize model on startup
    if not initialize_model():
        logger.warning("Model initialization failed, service starting without model")
    
    port = int(os.environ.get("AI_SERVICE_PORT", 5000))
    app.run(host="0.0.0.0", port=port)
