"""
Apple ml-sharp model wrapper for Gaussian Splatting.
Compatible with Mac M4 (MPS), CPU, and CUDA backends.

This wrapper calls the ml-sharp CLI via subprocess, which handles:
- Automatic checkpoint download/caching
- Device detection (CUDA/MPS/CPU)
- PLY output generation
"""
import os
import subprocess
import tempfile
from pathlib import Path
from ..config import Config


class SharpModel:
    """
    Wrapper for Apple ml-sharp Gaussian Splatting model.
    Uses subprocess to call the sharp CLI for better memory management.
    """
    
    CHECKPOINT_URL = "https://ml-site.cdn-apple.com/models/sharp/sharp_2572gikvuh.pt"
    CHECKPOINT_DIR = Path.home() / ".cache/torch/hub/checkpoints"
    CHECKPOINT_FILENAME = "sharp_2572gikvuh.pt"
    
    def __init__(self):
        self._is_downloaded = None
    
    @property
    def checkpoint_path(self) -> Path:
        return self.CHECKPOINT_DIR / self.CHECKPOINT_FILENAME
    
    def is_downloaded(self) -> bool:
        """Check if model checkpoint exists on disk"""
        if self._is_downloaded is None:
            self._is_downloaded = self.checkpoint_path.exists()
        return self._is_downloaded
    
    def check_downloaded(self) -> bool:
        """Force re-check of download status (invalidates cache)"""
        self._is_downloaded = self.checkpoint_path.exists()
        return self._is_downloaded
    
    def download(self) -> bool:
        """
        Download model checkpoint from Apple CDN.
        Returns True if successful, raises exception otherwise.
        """
        self.CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)
        
        try:
            # Use wget or curl depending on what's available
            if self._command_exists("wget"):
                subprocess.run([
                    "wget", "-q", "--show-progress",
                    "-O", str(self.checkpoint_path),
                    self.CHECKPOINT_URL
                ], check=True)
            elif self._command_exists("curl"):
                subprocess.run([
                    "curl", "-L", "-o", str(self.checkpoint_path),
                    self.CHECKPOINT_URL
                ], check=True)
            else:
                raise RuntimeError("Neither wget nor curl available for download")
            
            self._is_downloaded = True
            return True
        except subprocess.CalledProcessError as e:
            # Clean up partial download
            if self.checkpoint_path.exists():
                self.checkpoint_path.unlink()
            raise RuntimeError(f"Failed to download SHARP model: {e}")
    
    def _command_exists(self, cmd: str) -> bool:
        """Check if a command exists in PATH"""
        try:
            subprocess.run(
                ["which", cmd] if os.name != 'nt' else ["where", cmd],
                capture_output=True,
                check=True
            )
            return True
        except subprocess.CalledProcessError:
            return False
    
    def predict(self, input_image_path: str, output_dir: str) -> str:
        """
        Generate Gaussian Splat from image using ml-sharp CLI.
        
        Args:
            input_image_path: Path to input image file
            output_dir: Directory to write output .ply file
            
        Returns:
            Path to generated .ply file
            
        Raises:
            RuntimeError: If generation fails or no PLY file is produced
        """
        if not self.is_downloaded():
            print("[SharpModel] Model not downloaded, downloading now...")
            self.download()
        
        # Ensure output directory exists
        os.makedirs(output_dir, exist_ok=True)
        
        # Build command
        # sharp predict -i <input> -o <output> [-c <checkpoint>]
        cmd = [
            "sharp", "predict",
            "-i", input_image_path,
            "-o", output_dir
        ]
        
        # Add checkpoint path if exists locally
        if self.checkpoint_path.exists():
            cmd.extend(["-c", str(self.checkpoint_path)])
        
        print(f"[SharpModel] Running: {' '.join(cmd)}")
        
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=True,
                timeout=300  # 5 minute timeout
            )
            print(f"[SharpModel] Output: {result.stdout}")
            
        except subprocess.TimeoutExpired:
            raise RuntimeError("SHARP prediction timed out (>5 minutes)")
        except subprocess.CalledProcessError as e:
            raise RuntimeError(
                f"SHARP prediction failed:\nstdout: {e.stdout}\nstderr: {e.stderr}"
            )
        
        # Find generated .ply file
        ply_files = list(Path(output_dir).glob("*.ply"))
        if not ply_files:
            raise RuntimeError(
                f"No PLY file generated in {output_dir}. "
                f"Contents: {list(Path(output_dir).iterdir())}"
            )
        
        # Return the first (and usually only) PLY file
        return str(ply_files[0])


# Singleton instance
sharp_model = SharpModel()
