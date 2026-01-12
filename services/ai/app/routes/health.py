from flask import Blueprint, jsonify
from ..models.depth_model import model

health_bp = Blueprint('health', __name__)

@health_bp.route('/health', methods=['GET'])
def health():
    model_status = "loaded" if model.is_loaded else "not_loaded"
    return jsonify({
        "status": "healthy",
        "service": "ai",
        "model": "Depth-Anything-V2",
        "model_status": model_status
    })

@health_bp.route('/', methods=['GET'])
def index():
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
