import io
from flask import Blueprint, request, jsonify, send_file
from PIL import Image
import numpy as np
from ..models.depth_model import model
from ..config import Config

depth_bp = Blueprint('depth', __name__)

@depth_bp.route('/api/depth', methods=['POST'])
def process_depth():
    """
    Process an image and generate its depth map.
    
    Query params:
        model: Optional model to use (small, base, large)
        
    Form data:
        image: Image file to process
        
    Returns:
        PNG depth map image
    """
    # Removed immediate is_loaded check to allow lazy loading in model.predict()

    if 'image' not in request.files:
         return jsonify({"error": "No image provided", "message": "Please upload 'image'"}), 400
         
    file = request.files['image']
    if file.filename == '':
        return jsonify({"error": "Empty filename", "message": "No file selected"}), 400
    
    # Optional: specify which model to use
    requested_model = request.args.get('model')
    if requested_model:
        if requested_model not in Config.AVAILABLE_MODELS:
            return jsonify({
                "error": "Invalid model",
                "message": f"Unknown model '{requested_model}'. Available: {list(Config.AVAILABLE_MODELS.keys())}"
            }), 400
        
    try:
        # Read image
        image_bytes = file.read()
        image = Image.open(io.BytesIO(image_bytes))
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Generate depth map (will switch model if different from current)
        result = model.predict(image, model_key=requested_model)
        depth_map = result["depth"]
        
        # Normalize to 0-255 range
        depth_array = np.array(depth_map)
        depth_min = depth_array.min()
        depth_max = depth_array.max()
        
        if depth_max - depth_min < 1e-10:
            depth_normalized = np.full_like(depth_array, 128, dtype=np.uint8)
        else:
            depth_normalized = ((depth_array - depth_min) / (depth_max - depth_min) * 255).astype(np.uint8)
            
        depth_image = Image.fromarray(depth_normalized)
        
        img_io = io.BytesIO()
        depth_image.save(img_io, 'PNG')
        img_io.seek(0)
        
        response = send_file(
            img_io,
            mimetype='image/png',
            as_attachment=True,
            download_name=f"depth_{file.filename.rsplit('.', 1)[0]}.png"
        )
        
        # Add model info to response headers
        response.headers['X-Model-Used'] = model.current_model_key
        
        return response
        
    except Exception as e:
        return jsonify({"error": "Processing failed", "message": str(e)}), 500

