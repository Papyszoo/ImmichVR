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
    
    # Add depth models
    for key, config in Config.AVAILABLE_MODELS.items():
        model_info = {
            "key": key,
            "name": config["name"],
            "type": "depth",  # All models in Config.AVAILABLE_MODELS are depth models
            "params": config["params"],
            "memory": config["memory"],
            "description": config["description"],
            "huggingface_id": config["id"],
            "is_loaded": model.current_model_key == key,
            "is_downloaded": key in downloaded_models,
        }
        models_list.append(model_info)
    
    # Add SHARP model (splat generation)
    try:
        from ..models.sharp_model import sharp_model
        
        # NEW LOGIC: Get real status from the class
        status = sharp_model.get_status()
        
        models_list.append({
            "key": "sharp",
            "name": "SHARP",
            "type": "splat",
            "params": "~2GB",
            "memory": "~4GB RAM",
            "description": "Apple ml-sharp: Photorealistic 3D Gaussian Splat.",
            "huggingface_id": "apple/ml-sharp",
            "is_loaded": status["is_loaded"], # Now dynamic!
            "is_downloaded": status["is_downloaded"],
        })
    except Exception as e:
        logger.warning(f"Could not include SHARP model status: {e}")
    
    # Determine current device type for frontend
    current_device_type = None
    if model.is_loaded:
        if model.device == 0: current_device_type = 'gpu' # Generic GPU (CUDA)
        elif model.device == 'mps': current_device_type = 'gpu' # Generic GPU (MPS)
        else: current_device_type = 'cpu'
    
    # Check SHARP status
    try:
        from ..models.sharp_model import sharp_model
        sharp_status = sharp_model.get_status()
        if sharp_status['is_loaded']:
             # If SHARP is loaded, it overrides or co-exists. 
             # For UI purposes, if SHARP is active, report its device.
             s_dev = sharp_status['device']
             if s_dev == 'cuda' or s_dev == 'mps': current_device_type = 'gpu'
             elif s_dev == 'cpu': current_device_type = 'cpu'
             # If s_dev is 'auto', we don't know, but likely resolved in load.
             
             # Also update current_model if depth model is not loaded
             if model.current_model_key is None:
                 # We don't have a mutable current_model_key variable here easily accessible to override the json response key...
                 # But the frontend looks at the top-level `current_model`.
                 pass
    except:
        pass

    return jsonify({
        "models": models_list,
        "current_model": model.current_model_key if model.is_loaded else ("sharp" if (
            'sharp_model' in locals() and sharp_model.get_status()['is_loaded']
        ) else None),
        "current_device": current_device_type,
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
    if model_key == "sharp":
        try:
            from ..models.sharp_model import sharp_model
            
            # Extract optional device parameter (same as below)
            data = request.get_json() or {}
            device_type = data.get('device', 'auto')
            
            sharp_model.load_model(device_type=device_type) 
            return jsonify({
                "success": True, 
                "message": f"SHARP model loaded on {sharp_model.device}",
                "current_model": "sharp"
            })
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

    if model_key not in Config.AVAILABLE_MODELS:
        return jsonify({
            "error": "Unknown model",
            "message": f"Model '{model_key}' not found. Available: {list(Config.AVAILABLE_MODELS.keys())}"
        }), 400
    
    
    # Extract optional device parameter
    data = request.get_json() or {}
    device_type = data.get('device', 'auto')
    
    try:
        success = model.switch_model(model_key, device_type=device_type)
        
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


@models_bp.route('/api/models/<model_key>/download', methods=['POST'])
def download_model(model_key: str):
    """
    Download a model to disk without loading it.
    
    Args:
        model_key: Model to download
        
    Returns:
        JSON with success status
    """
    if model_key not in Config.AVAILABLE_MODELS:
        return jsonify({
            "error": "Unknown model",
            "message": f"Model '{model_key}' not found"
        }), 400
    
    try:
        success = model.download_model(model_key)
        
        if success:
            return jsonify({
                "success": True,
                "message": f"Model '{model_key}' downloaded successfully"
            })
        else:
            return jsonify({
                "success": False,
                "error": "Failed to download model",
                "message": f"Could not download model '{model_key}'"
            }), 500
            
    except Exception as e:
        logger.error(f"Error downloading model {model_key}: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Model download error",
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
    # Handler for SHARP model
    if model_key == "sharp":
        try:
            from ..models.sharp_model import sharp_model
            sharp_model.unload_model()
            return jsonify({
                "success": True,
                "message": "Model 'sharp' unloaded successfully"
            })
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

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
