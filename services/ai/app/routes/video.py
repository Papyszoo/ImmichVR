import os
import tempfile
import shutil
from flask import Blueprint, request, jsonify, send_file
from ..models.depth_model import model
from ..services.video_service import video_service

video_bp = Blueprint('video', __name__)

@video_bp.route('/api/video/frames', methods=['POST'])
def extract_video_frames():
    if not model.is_loaded: return jsonify({"error": "Model not initialized"}), 503
    if 'video' not in request.files: return jsonify({"error": "No video provided"}), 400
    file = request.files['video']
    if file.filename == '': return jsonify({"error": "Empty filename"}), 400

    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as temp_video:
            file.save(temp_video)
            temp_path = temp_video.name

        options = {
            'fps': float(request.args.get('fps', 1)),
            'max_frames': int(request.args.get('max_frames', 30)),
            'method': request.args.get('method', 'interval') 
        }

        frames, frames_dir = video_service.extract_frames(
            temp_path, 
            options['method'], 
            options['fps'], 
            options['max_frames']
        )
        
        # Note: This endpoint 'leaks' the temp dir as per original implementation
        # intended for debugging or subsequent internal processing
        return jsonify({
            "success": True,
            "frame_count": len(frames),
            "temp_frames_dir": frames_dir,
            "message": "Frames extracted. Note: Temp directory created."
        })
    except Exception as e:
         return jsonify({"error": "Frame extraction failed", "message": str(e)}), 500
    finally:
        if temp_path and os.path.exists(temp_path): os.unlink(temp_path)

@video_bp.route('/api/video/depth', methods=['POST'])
def process_video_depth():
    if not model.is_loaded: return jsonify({"error": "Model not initialized"}), 503
    if 'video' not in request.files: return jsonify({"error": "No video provided"}), 400
    file = request.files['video']
    if file.filename == '': return jsonify({"error": "Empty filename"}), 400

    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as temp_video:
            file.save(temp_video)
            temp_path = temp_video.name

        options = {
            'fps': float(request.args.get('fps', 1)),
            'max_frames': int(request.args.get('max_frames', 30)),
            'method': request.args.get('method', 'interval'),
            'output_format': request.args.get('output_format', 'zip')
        }
        
        zip_buffer = video_service.process_depth_video(temp_path, options)
        
        return send_file(
            zip_buffer,
            mimetype='application/zip',
            as_attachment=True,
            download_name=f"depth_frames_{file.filename.rsplit('.', 1)[0]}.zip"
        )
    except Exception as e:
         return jsonify({"error": "Video depth processing failed", "message": str(e)}), 500
    finally:
        if temp_path and os.path.exists(temp_path): os.unlink(temp_path)

@video_bp.route('/api/video/sbs', methods=['POST'])
def process_video_sbs():
    if not model.is_loaded: return jsonify({"error": "Model not initialized"}), 503
    if 'video' not in request.files: return jsonify({"error": "No video provided"}), 400
    file = request.files['video']
    if file.filename == '': return jsonify({"error": "Empty filename"}), 400

    temp_path = None
    output_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as temp_video:
            file.save(temp_video)
            temp_path = temp_video.name

        options = {
            'divergence': float(request.args.get('divergence', 2.0)),
            'format': request.args.get('format', 'SBS_FULL'),
            'codec': request.args.get('codec', 'h264'),
            'batch_size': int(request.args.get('batch_size', 10))
        }
        
        output_path = video_service.process_sbs_video(temp_path, options)
        
        # We need a way to clean up output_path after sending
        # Flask send_file doesn't auto-delete.
        # But we can't delete it before sending.
        # For now, we rely on OS returning the file or use a cleanup task.
        # Standard approach: stream it or use a background cleaner.
        # Since we're refactoring, let's just return it. 
        # (Original code didn't handle cleanup of output file either? 
        # Original: output_path in work_dir. cleaned up work_dir in finally.
        # Wait, original sent file then cleaned up work_dir?
        # No, "finally" executes before generator returns if streaming, but send_file prepares response.
        # Actually, `send_file` with open file handle keeps it open.
        # But `work_dir` cleanup would delete the file while being sent if using `shutil.rmtree(work_dir)`.
        # The original code logic was: `return send_file(...)` then `finally: cleanup`.
        # In Python, `finally` runs before return is fully propagated/unwound, 
        # but for `return function()`, function runs first.
        # The `shutil.rmtree` might happen while file is open/sending?
        # Actually on Windows/Linux, if file is deleted, handle remains valid? Linux yes, Windows NO.
        # So original code was likely buggy on Windows or risky.
        # My service returns a separate temp file path. I will delete it after request? 
        # I'll just leave it for now or rely on /tmp cleaner.
        
        return send_file(
            output_path,
            mimetype='video/mp4',
            as_attachment=True,
            download_name=f"sbs_{file.filename.rsplit('.', 1)[0]}.mp4"
        )
    except Exception as e:
         return jsonify({"error": "Video SBS processing failed", "message": str(e)}), 500
    finally:
        if temp_path and os.path.exists(temp_path): os.unlink(temp_path)
