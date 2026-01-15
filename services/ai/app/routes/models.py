"""
Model management API routes.
Handles listing models, download status, and model switching.
"""
import logging
from flask import Blueprint, jsonify, request
from ..config import Config
from ..models.depth_model import model

logger = logging.getLogger(__name__)

models_bp = Blueprint('models', __name__)


@models_bp.route('/api/models', methods=['GET'])
def list_models():
    """
    List all available models with their metadata and status.
    
    Returns:
        JSON array of model information
    """
    models_list = []
    downloaded_models = model._get_downloaded_models()
    
    for key, config in Config.AVAILABLE_MODELS.items():
        model_info = {
            "key": key,
            "name": config["name"],
            "params": config["params"],
            "memory": config["memory"],
            "description": config["description"],
            "huggingface_id": config["id"],
            "is_loaded": model.current_model_key == key,
            "is_downloaded": key in downloaded_models,
        }
        models_list.append(model_info)
    
    return jsonify({
        "models": models_list,
        "current_model": model.current_model_key,
        "default_model": Config.DEFAULT_MODEL,
    })


@models_bp.route('/api/models/current', methods=['GET'])
def get_current_model():
    """
    Get the currently loaded model information.
    
    Returns:
        JSON with current model status
    """
    return jsonify(model.get_status())


@models_bp.route('/api/models/<model_key>/load', methods=['POST'])
def load_model(model_key: str):
    """
    Load/switch to a specific model.
    
    Args:
        model_key: Model to load (small, base, large)
        
    Returns:
        JSON with success status
    """
    if model_key not in Config.AVAILABLE_MODELS:
        return jsonify({
            "error": "Unknown model",
            "message": f"Model '{model_key}' not found. Available: {list(Config.AVAILABLE_MODELS.keys())}"
        }), 400
    
    try:
        success = model.switch_model(model_key)
        
        if success:
            return jsonify({
                "success": True,
                "message": f"Model '{model_key}' loaded successfully",
                "current_model": model.current_model_key,
            })
        else:
            return jsonify({
                "success": False,
                "error": "Failed to load model",
                "message": f"Could not load model '{model_key}'"
            }), 500
            
    except Exception as e:
        logger.error(f"Error loading model {model_key}: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Model load error",
            "message": str(e)
        }), 500


@models_bp.route('/api/models/<model_key>/unload', methods=['POST'])
def unload_model(model_key: str):
    """
    Unload a specific model (if it's currently loaded).
    
    Args:
        model_key: Model to unload
        
    Returns:
        JSON with success status
    """
    if model.current_model_key != model_key:
        return jsonify({
            "success": True,
            "message": f"Model '{model_key}' is not currently loaded"
        })
    
    try:
        model._unload_current_model()
        return jsonify({
            "success": True,
            "message": f"Model '{model_key}' unloaded successfully"
        })
    except Exception as e:
        logger.error(f"Error unloading model {model_key}: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Model unload error",
            "message": str(e)
        }), 500


@models_bp.route('/api/models/<model_key>', methods=['DELETE'])
def delete_model(model_key: str):
    """
    Delete a downloaded model from disk.
    
    Args:
        model_key: Model to delete
        
    Returns:
        JSON with success status
    """
    if model_key not in Config.AVAILABLE_MODELS:
        return jsonify({
            "error": "Unknown model",
            "message": f"Model '{model_key}' not found"
        }), 400
    
    try:
        success = model.delete_model(model_key)
        
        if success:
            return jsonify({
                "success": True,
                "message": f"Model '{model_key}' deleted successfully"
            })
        else:
            return jsonify({
                "success": False,
                "error": "Failed to delete model",
                "message": f"Could not delete model '{model_key}' (maybe not found?)"
            }), 404
            
    except Exception as e:
        logger.error(f"Error deleting model {model_key}: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Model delete error",
            "message": str(e)
        }), 500
