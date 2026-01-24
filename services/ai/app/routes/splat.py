"""
Splat generation endpoint for Apple ml-sharp.

POST /api/splat - Generate .ply Gaussian Splat from image
GET /api/splat/status - Check if SHARP model is downloaded
"""
import io
import os
import tempfile
from pathlib import Path
from flask import Blueprint, request, jsonify, send_file
from PIL import Image
from ..models.sharp_model import sharp_model

splat_bp = Blueprint('splat', __name__)


@splat_bp.route('/api/splat', methods=['POST'])
def generate_splat():
    """
    Generate Gaussian Splat (.ply) from uploaded image.
    
    Form data:
        image: Image file to process
        
    Returns:
        PLY file (3D Gaussian Splat binary)
    """
    if 'image' not in request.files:
        return jsonify({
            "error": "No image provided",
            "message": "Please upload an 'image' file"
        }), 400
    
    file = request.files['image']
    if file.filename == '':
        return jsonify({
            "error": "Empty filename",
            "message": "No file selected"
        }), 400
    
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            # Save input image
            input_path = os.path.join(tmpdir, "input.jpg")
            output_dir = os.path.join(tmpdir, "output")
            os.makedirs(output_dir, exist_ok=True)
            
            # Read image bytes
            image_bytes = file.read()
            
            # INSPECT: Check if we can just write bytes directly to preserve EXIF/Metadata
            # This is critical for Orientation and Focal Length detection in sharp_model.
            try:
                # Peek at format
                img_peek = Image.open(io.BytesIO(image_bytes))
                is_jpeg = img_peek.format == 'JPEG' or img_peek.format == 'MPO'
                
                if is_jpeg:
                    # Write RAW bytes to preserve exact metadata
                    with open(input_path, 'wb') as f:
                        f.write(image_bytes)
                    print(f"[Splat] Saved RAW input image to {input_path} (Format: {img_peek.format})")
                else:
                    # For non-JPEGs, we must convert/save
                    # Try to preserve EXIF if possible
                    exif_data = img_peek.info.get('exif')
                    
                    if img_peek.mode != 'RGB':
                        img_peek = img_peek.convert('RGB')
                        
                    save_kwargs = {'quality': 95}
                    if exif_data:
                        save_kwargs['exif'] = exif_data
                        
                    img_peek.save(input_path, 'JPEG', **save_kwargs)
                    print(f"[Splat] Converted and saved input image to {input_path}")
                    
            except Exception as e:
                print(f"[Splat] Error inspecting image, falling back to standard convert: {e}")
                image = Image.open(io.BytesIO(image_bytes))
                if image.mode != 'RGB':
                    image = image.convert('RGB')
                image.save(input_path, 'JPEG', quality=95)
            
            # Generate splat
            ply_path = sharp_model.predict(input_path, output_dir)
            
            print(f"[Splat] Generated PLY at {ply_path}")
            
            # Get file stats
            ply_size = os.path.getsize(ply_path)
            
            # Read PLY into memory (since tmpdir will be deleted)
            with open(ply_path, 'rb') as f:
                ply_data = io.BytesIO(f.read())
            
            # Create response with PLY file
            response = send_file(
                ply_data,
                mimetype='application/octet-stream',
                as_attachment=True,
                download_name=f"splat_{Path(file.filename).stem}.ply"
            )
            
            # Add metadata headers
            response.headers['X-Model-Used'] = 'sharp'
            response.headers['X-File-Size'] = str(ply_size)
            
            return response
    
    except RuntimeError as e:
        return jsonify({
            "error": "Splat generation failed",
            "message": str(e)
        }), 500
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            "error": "Processing failed",
            "message": str(e)
        }), 500


@splat_bp.route('/api/splat/status', methods=['GET'])
def splat_status():
    """
    Check if SHARP model is downloaded and ready.
    
    Returns:
        JSON with model status information
    """
    is_downloaded = sharp_model.check_downloaded()
    
    return jsonify({
        "model_key": "sharp",
        "model_name": "SHARP",
        "is_downloaded": is_downloaded,
        "checkpoint_path": str(sharp_model.checkpoint_path),
        "checkpoint_url": sharp_model.CHECKPOINT_URL
    })


@splat_bp.route('/api/splat/download', methods=['POST'])
def download_model():
    """
    Trigger download of the SHARP model checkpoint.
    
    Returns:
        JSON with download status
    """
    if sharp_model.is_downloaded():
        return jsonify({
            "status": "already_downloaded",
            "message": "SHARP model is already downloaded"
        })
    
    try:
        sharp_model.download()
        return jsonify({
            "status": "success",
            "message": "SHARP model downloaded successfully"
        })
    except RuntimeError as e:
        return jsonify({
            "status": "failed",
            "message": str(e)
        }), 500
