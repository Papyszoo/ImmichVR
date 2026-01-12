import io
from flask import Blueprint, request, jsonify, send_file
from PIL import Image
import numpy as np
from ..models.depth_model import model
from ..services.depth_service import process_frame_depth

depth_bp = Blueprint('depth', __name__)

@depth_bp.route('/api/depth', methods=['POST'])
def process_depth():
    if not model.is_loaded:
        return jsonify({
            "error": "Model not initialized", 
            "message": "Depth estimation model is not available"
        }), 503

    if 'image' not in request.files:
         return jsonify({"error": "No image provided", "message": "Please upload 'image'"}), 400
         
    file = request.files['image']
    if file.filename == '':
        return jsonify({"error": "Empty filename", "message": "No file selected"}), 400
        
    try:
        # Read image
        image_bytes = file.read()
        image = Image.open(io.BytesIO(image_bytes))
        if image.mode != 'RGB':
            image = image.convert('RGB')
            
        # Process (using service usually, but simple enough to use model here or service wrapper)
        # Using model directly for now as it returns PIL-compatible dict, 
        # but service returns numpy array. Let's use service logic to keep consistent
        # Wait, service consumes numpy array (cv2). 
        # I'll convert PIL to numpy for service or use model directly since route has PIL.
        # The service 'process_frame_depth' expects numpy layout.
        # Let's use model directly here for simplicity as originally done, 
        # or adapt to service.
        # Original: model(image)["depth"] -> PIL -> send_file
        
        result = model.predict(image)
        depth_map = result["depth"] # PIL Image
        
        # Normalize logic is needed? Model output is raw depth? 
        # Transformers pipeline 'depth-estimation' returns a PIL image of depth map usually visualized.
        # But wait, original code did: depth_array = np.array(depth_map)... normalization ... Image.fromarray
        # So yes, normalization is needed.
        
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
        
        return send_file(
            img_io,
            mimetype='image/png',
            as_attachment=True,
            download_name=f"depth_{file.filename.rsplit('.', 1)[0]}.png"
        )
        
    except Exception as e:
        return jsonify({"error": "Processing failed", "message": str(e)}), 500
