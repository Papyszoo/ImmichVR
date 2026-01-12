import os
import shutil
import tempfile
import zipfile
import subprocess
import logging
from pathlib import Path
import cv2
import torch
import io
from .depth_service import process_frame_depth
from .stereo_service import generate_stereo_pair_vectorized, compose_sbs_frame
from ..utils.video_utils import get_video_fps
from ..config import Config

logger = logging.getLogger(__name__)

class VideoService:
    def extract_frames(self, video_path, method='interval', fps=1, max_frames=30):
        """Extract frames from video."""
        frames_dir = tempfile.mkdtemp()
        
        try:
            if method == 'keyframes':
                cmd = [
                    'ffmpeg', '-i', video_path,
                    '-vf', f'select=eq(pict_type\\,I),scale=-1:480',
                    '-vsync', 'vfr',
                    '-frames:v', str(max_frames),
                    f'{frames_dir}/frame_%04d.png'
                ]
            else:
                cmd = [
                    'ffmpeg', '-i', video_path,
                    '-vf', f'fps={fps},scale=-1:480',
                    '-frames:v', str(max_frames),
                    f'{frames_dir}/frame_%04d.png'
                ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            if result.returncode != 0:
                raise Exception(f"FFmpeg error: {result.stderr}")
            
            frame_files = sorted(Path(frames_dir).glob('frame_*.png'))
            return list(frame_files), frames_dir
        except Exception:
            if os.path.exists(frames_dir):
                shutil.rmtree(frames_dir)
            raise

    def process_depth_video(self, video_path, options):
        """Generate depth maps for video frames and return ZIP buffer."""
        frames_dir = None
        depth_maps_dir = None
        
        try:
            # unique output dir
            depth_maps_dir = tempfile.mkdtemp()
            
            # Extract frames
            frame_files, frames_dir = self.extract_frames(
                video_path, 
                options.get('method'), 
                options.get('fps'), 
                options.get('max_frames')
            )
            
            logger.info(f"Processing {len(frame_files)} frames")
            
            for i, frame_path in enumerate(frame_files):
                frame = cv2.imread(str(frame_path))
                if frame is None: continue
                
                depth_norm = process_frame_depth(frame)
                
                # Save
                depth_path = Path(depth_maps_dir) / f"depth_{frame_path.stem}.png"
                cv2.imwrite(str(depth_path), depth_norm)
            
            # Zip
            zip_buffer = io.BytesIO()
            with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
                for depth_file in sorted(Path(depth_maps_dir).glob('depth_*.png')):
                    zip_file.write(depth_file, depth_file.name)
            zip_buffer.seek(0)
            
            return zip_buffer
            
        finally:
            if frames_dir: shutil.rmtree(frames_dir, ignore_errors=True)
            if depth_maps_dir: shutil.rmtree(depth_maps_dir, ignore_errors=True)

    def process_sbs_video(self, video_path, options):
        """Generate SBS video."""
        work_dir = None
        
        try:
            work_dir = tempfile.mkdtemp(prefix='sbs_')
            frames_dir = os.path.join(work_dir, 'frames')
            sbs_frames_dir = os.path.join(work_dir, 'sbs_frames')
            os.makedirs(frames_dir)
            os.makedirs(sbs_frames_dir)
            
            divergence = options.get('divergence', 2.0)
            sbs_format = options.get('format', 'SBS_FULL')
            batch_size = options.get('batch_size', 10)
            codec = options.get('codec', 'h264')
            
            # Extract ALL frames
            cmd = [
                'ffmpeg', '-i', video_path,
                '-qscale:v', '2',
                f'{frames_dir}/frame_%06d.png'
            ]
            subprocess.run(cmd, check=True, capture_output=True, timeout=300)
            
            frame_files = sorted(Path(frames_dir).glob('frame_*.png'))
            total_frames = len(frame_files)
            
            # Process in batches
            for batch_start in range(0, total_frames, batch_size):
                batch_end = min(batch_start + batch_size, total_frames)
                batch_frames = frame_files[batch_start:batch_end]
                
                for frame_path in batch_frames:
                    frame = cv2.imread(str(frame_path))
                    if frame is None: continue
                    
                    depth_map = process_frame_depth(frame)
                    
                    if depth_map.shape[:2] != frame.shape[:2]:
                         depth_map = cv2.resize(depth_map, (frame.shape[1], frame.shape[0]))
                         
                    left, right = generate_stereo_pair_vectorized(frame, depth_map, divergence)
                    sbs_frame = compose_sbs_frame(left, right, sbs_format)
                    
                    cv2.imwrite(os.path.join(sbs_frames_dir, frame_path.name), sbs_frame)
                
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
            
            # Encode
            original_fps = get_video_fps(video_path)
            output_filename = f"sbs_output.mp4"
            output_path = os.path.join(work_dir, output_filename)
             
            video_codec = 'libx265' if codec == 'hevc' else 'libx264'
            codec_opts = ['-preset', 'medium', '-crf', '23']
            if codec == 'hevc': codec_opts += ['-tag:v', 'hvc1']
            
            encode_cmd = [
                'ffmpeg', '-y',
                '-framerate', str(original_fps),
                '-i', f'{sbs_frames_dir}/frame_%06d.png',
                '-i', video_path,
                '-map', '0:v', '-map', '1:a?',
                '-c:v', video_codec, *codec_opts,
                '-c:a', 'copy', '-pix_fmt', 'yuv420p',
                output_path
            ]
            subprocess.run(encode_cmd, check=True, capture_output=True, timeout=600)
            
            # Return path to file (caller must clean up work_dir)
            # Create a persistent temp file to return, allowing work_dir cleanup
            final_output = tempfile.NamedTemporaryFile(delete=False, suffix='.mp4').name
            shutil.move(output_path, final_output)
            return final_output
            
        finally:
            if work_dir and os.path.exists(work_dir):
                shutil.rmtree(work_dir, ignore_errors=True)

video_service = VideoService()
