# Experimental Video Depth Map Support

## Overview

ImmichVR now includes **experimental support** for generating depth maps from video files and converting 2D videos to **Side-by-Side (SBS) 3D format**. This feature processes videos offline using depth estimation to create VR-ready content suitable for playback on Meta Quest and other VR headsets.

⚠️ **EXPERIMENTAL FEATURE**: This feature is in early stages and has known limitations. It is disabled by default and must be explicitly enabled.

## How It Works

### Video Processing Pipeline (SBS Output)

The main video processing pipeline generates Side-by-Side 3D videos:

1. **Video Upload/Import**: Video files are uploaded or imported from Immich
2. **Queue Processing**: Videos are queued with lower priority than photos
3. **Frame Extraction**: FFmpeg extracts all frames at original FPS
4. **Depth Map Generation**: Each frame is processed through Depth Anything V2 model
5. **Stereo Generation**: Left and right eye views are generated using NumPy vectorized operations
6. **SBS Composition**: Left and right views are stitched horizontally (Side-by-Side)
7. **Video Encoding**: Final SBS video is encoded with H.264/HEVC, preserving original audio
8. **Storage**: SBS video file is stored for VR playback

### Stereo Generation Algorithm

The stereo pair generation uses **NumPy vectorized operations** for efficient processing:

1. **Depth Normalization**: Depth map values are normalized to 0-1 range
2. **Displacement Calculation**: Pixel displacement is calculated based on depth (closer = more displacement)
3. **Coordinate Grid**: `np.meshgrid` creates coordinate grids for efficient warping
4. **Image Warping**: `cv2.remap` applies the displacement to generate left/right eye views
5. **Composition**: Views are horizontally concatenated for SBS output

**No Python for-loops over pixels are used** - all operations are vectorized for performance.

### Frame Extraction Methods (Legacy Depth-Only Mode)

For the legacy depth-only processing mode:

#### 1. Interval-Based (Default)
Extracts frames at a fixed frame rate (FPS):
- More predictable output
- Evenly spaced frames throughout the video
- Best for smooth video playback
- Configurable FPS (default: 1 fps)

#### 2. Keyframe-Based
Extracts only keyframes (I-frames):
- Fewer frames extracted
- Less predictable timing
- Captures scene changes efficiently
- May miss content between keyframes

## Configuration

### Environment Variables

Add to your `.env` file:

```bash
# Enable experimental video processing
ENABLE_EXPERIMENTAL_VIDEO=true

# SBS Processing Configuration
VIDEO_SBS_DIVERGENCE=2.0     # Strength of 3D effect (0.5 - 10.0)
VIDEO_SBS_FORMAT=SBS_FULL    # SBS_FULL (double width) or SBS_HALF (original width)

# Legacy frame-based configuration (used for /api/video/depth endpoint)
# Frame extraction rate (frames per second)
VIDEO_FRAME_EXTRACTION_FPS=1

# Maximum frames to extract per video
VIDEO_MAX_FRAMES=30

# Extraction method: 'interval' or 'keyframes'
VIDEO_FRAME_METHOD=interval
```

### Default Values

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_EXPERIMENTAL_VIDEO` | `false` | Enable/disable video processing |
| `VIDEO_SBS_DIVERGENCE` | `2.0` | Strength of 3D effect (0.5-10.0) |
| `VIDEO_SBS_FORMAT` | `SBS_FULL` | SBS_FULL (double width) or SBS_HALF |
| `VIDEO_FRAME_EXTRACTION_FPS` | `1` | Frames per second for legacy mode (max: 30) |
| `VIDEO_MAX_FRAMES` | `30` | Maximum frames for legacy mode (max: 100) |
| `VIDEO_FRAME_METHOD` | `interval` | Extraction method for legacy mode |

## Usage

### 1. Enable the Feature

Update your `.env` file:
```bash
ENABLE_EXPERIMENTAL_VIDEO=true

# Optional: Configure 3D effect strength
VIDEO_SBS_DIVERGENCE=2.0
VIDEO_SBS_FORMAT=SBS_FULL
```

Restart the services:
```bash
docker compose down
docker compose up -d
```

### 2. Upload a Video

```bash
# Upload video file
curl -X POST http://localhost:3000/api/media/upload \
  -F "media=@video.mp4"
```

Response:
```json
{
  "success": true,
  "message": "Media uploaded and queued for processing",
  "mediaItemId": "uuid",
  "queueId": "uuid",
  "filename": "video.mp4",
  "size": 10485760,
  "type": "video"
}
```

### 3. Monitor Processing

```bash
# Check queue status
curl http://localhost:3000/api/queue/items/QUEUE_ID
```

### 4. Retrieve SBS Video

```bash
# Get SBS video info
curl http://localhost:3000/api/media/MEDIA_ITEM_ID/depth/info

# Download SBS video file
curl http://localhost:3000/api/media/MEDIA_ITEM_ID/depth \
  -o video_sbs.mp4
```

The output is a standard MP4 file in Side-by-Side format:
- Left eye view on the left half
- Right eye view on the right half
- Original audio preserved
- Compatible with standard VR video players

## API Endpoints

### AI Service Endpoints (Experimental)

#### Process Video to SBS 3D (Primary Endpoint)
```
POST /api/video/sbs
```

Upload a video and generate a Side-by-Side 3D video.

**Query Parameters:**
- `divergence`: Strength of 3D effect (default: 2.0, range: 0.5-10.0)
- `format`: 'SBS_FULL' (double width) or 'SBS_HALF' (original width, default: SBS_FULL)
- `codec`: 'h264' (default) or 'hevc'
- `batch_size`: Frames to process at once for VRAM management (default: 10)

**Response:**
Returns an MP4 video file in Side-by-Side format with audio.

**Example:**
```bash
curl -X POST "http://localhost:5000/api/video/sbs?divergence=2.5&format=SBS_FULL" \
  -F "video=@myvideo.mp4" \
  -o output_sbs.mp4
```

#### Extract Video Frames (Legacy)
```
POST /api/video/frames
```

Upload a video and extract frames.

**Query Parameters:**
- `fps`: Frames per second (default: 1, max: 30)
- `max_frames`: Max frames to extract (default: 30, max: 100)
- `method`: 'interval' or 'keyframes' (default: 'interval')

**Response:**
```json
{
  "success": true,
  "filename": "video.mp4",
  "method": "interval",
  "fps": 1,
  "frame_count": 30,
  "max_frames": 30,
  "message": "Frames extracted successfully"
}
```

#### Process Video Depth Maps (Legacy)
```
POST /api/video/depth
```

Upload a video and generate depth maps for all frames.

**Query Parameters:**
- `fps`: Frames per second (default: 1, max: 30)
- `max_frames`: Max frames to extract (default: 30, max: 100)
- `method`: 'interval' or 'keyframes' (default: 'interval')
- `output_format`: 'zip' (default)

**Response:**
Returns a ZIP file containing depth map frames.

### Backend Endpoints

Video processing uses the same endpoints as photos:

```bash
# Upload video
POST /api/media/upload

# Get SBS video or depth map
GET /api/media/:mediaItemId/depth?version=full_resolution

# Get processing info
GET /api/media/:mediaItemId/depth/info
```

For videos, the output is now an MP4 SBS video file (previously ZIP file with depth frames).

## Output Format

### SBS Video Format (Primary)

The SBS (Side-by-Side) video output is a standard MP4 file:

**SBS_FULL Format:**
- Resolution: `(original_width * 2) x original_height`
- Example: 1920x1080 source → 3840x1080 SBS output
- Full resolution per eye
- Larger file size

**SBS_HALF Format:**
- Resolution: `original_width x original_height`
- Example: 1920x1080 source → 1920x1080 SBS output
- Half horizontal resolution per eye (960x1080 per eye)
- Smaller file size, compatible with more players

**Video Properties:**
- Codec: H.264 (default) or HEVC
- Audio: Original audio stream copied without re-encoding
- Container: MP4
- Compatible with all standard VR video players (Meta Quest, SteamVR, etc.)

### Legacy ZIP Format (Depth-Only Mode)

When using the `/api/video/depth` endpoint, the output is a ZIP file:

```
depth_frame_0001.png  # Frame 1 depth map
depth_frame_0002.png  # Frame 2 depth map
depth_frame_0003.png  # Frame 3 depth map
...
```

Each PNG is a grayscale depth map where:
- Darker values = closer to camera
- Lighter values = farther from camera
- 8-bit normalized (0-255)

### VR Playback

For VR viewing:
1. **SBS Video (Recommended)**: Play directly in any VR video player (e.g., Meta Quest TV, Skybox, Pigasus)
2. **Sequential playback**: Display depth frames in sequence synced to video timing
3. **3D mesh**: Convert depth maps to 3D meshes for immersive viewing

## Performance Considerations

### Processing Time

SBS video processing time depends on video length and resolution:

| Video Length | Resolution | Est. Time | Output Size |
|--------------|------------|-----------|-------------|
| 10 seconds   | 1080p      | ~2-5 min  | ~10-30 MB   |
| 30 seconds   | 1080p      | ~5-10 min | ~30-100 MB  |
| 1 minute     | 1080p      | ~10-20 min| ~60-200 MB  |

Processing is done frame-by-frame with batch management for VRAM efficiency.

### Resource Usage

- **Memory**: ~2-4GB RAM during processing
- **GPU VRAM**: Managed via batch processing (default: 10 frames per batch)
- **Disk**: Temporary space for frame processing (cleaned up after completion)
- **CPU/GPU**: High usage during depth estimation and video encoding

### Optimization Tips

1. **Lower divergence**: Use 1.0-2.0 for subtle 3D effect
2. **SBS_HALF format**: Smaller output files, faster encoding
3. **Shorter clips**: Process videos in segments for faster turnaround
4. **GPU acceleration**: Use CUDA-enabled GPU for faster inference

## Limitations

### Current Limitations

1. **Processing Time**: Very slow for long videos
2. **Frame Limit**: Maximum 100 frames per video (configurable to 30 by default)
3. **Resolution**: Frames scaled to 480p height for processing
4. **Storage**: Large ZIP files for videos with many frames
5. **No Timeline Info**: Frame timestamps not preserved
6. **No Audio**: Audio information is discarded
7. **Format Support**: Limited to FFmpeg-supported formats
8. **Memory**: May fail on very high-resolution videos

### Known Issues

1. **Timeout Risk**: Very long videos may timeout (5 min limit)
2. **Sequential Processing**: Frames processed one at a time (no batching)
3. **No Caching**: Re-processing extracts frames again
4. **ZIP Only**: No streaming or individual frame access

## Troubleshooting

### Video Processing Fails

**Error**: "Video processing is experimental and currently disabled"

**Solution**: Set `ENABLE_EXPERIMENTAL_VIDEO=true` in `.env` file

---

**Error**: "Processing timeout"

**Solution**: 
- Reduce `VIDEO_MAX_FRAMES`
- Lower `VIDEO_FRAME_EXTRACTION_FPS`
- Use shorter video clips

---

**Error**: "FFmpeg error"

**Solution**: 
- Check video file format is supported
- Ensure FFmpeg is installed in AI service container
- Check AI service logs: `docker compose logs ai`

### Slow Processing

**Issue**: Video takes very long to process

**Solutions**:
1. Reduce frame count: `VIDEO_MAX_FRAMES=10`
2. Lower FPS: `VIDEO_FRAME_EXTRACTION_FPS=0.5`
3. Use keyframe method: `VIDEO_FRAME_METHOD=keyframes`
4. Process shorter video segments

### High Memory Usage

**Issue**: Service crashes during video processing

**Solutions**:
1. Reduce max frames
2. Process videos in smaller segments
3. Increase Docker memory limit
4. Use lower resolution source videos

## Future Enhancements

Planned improvements for video support:

1. **Frame Batching**: Process multiple frames in parallel
2. **Timeline Metadata**: Preserve frame timestamps
3. **Streaming Output**: Stream frames instead of ZIP
4. **Smart Frame Selection**: AI-based scene change detection
5. **Adaptive Quality**: Adjust processing based on video content
6. **Progress Tracking**: Real-time progress updates
7. **Resume Support**: Resume interrupted processing
8. **Multiple Resolutions**: Generate depth maps at various resolutions
9. **Side-by-Side Output**: Direct VR-ready video output
10. **Temporal Consistency**: Smooth depth transitions between frames

## Examples

### Example 1: Basic Video Processing

```bash
# 1. Enable feature
echo "ENABLE_EXPERIMENTAL_VIDEO=true" >> .env
docker compose restart backend

# 2. Upload video
curl -X POST http://localhost:3000/api/media/upload \
  -F "media=@myvideo.mp4"

# 3. Wait for processing (check queue)
curl http://localhost:3000/api/queue/stats

# 4. Download depth maps
curl http://localhost:3000/api/media/MEDIA_ID/depth \
  -o depth_frames.zip

# 5. Extract and view
unzip depth_frames.zip
```

### Example 2: High Frame Rate Processing

```bash
# Configure for more frames
export VIDEO_FRAME_EXTRACTION_FPS=2
export VIDEO_MAX_FRAMES=60

# Upload and process
curl -X POST http://localhost:3000/api/media/upload \
  -F "media=@smooth_video.mp4"
```

### Example 3: Keyframe Extraction

```bash
# Use keyframes for scene-based extraction
export VIDEO_FRAME_METHOD=keyframes
export VIDEO_MAX_FRAMES=50

# Process video
curl -X POST http://localhost:3000/api/media/upload \
  -F "media=@scene_video.mp4"
```

## Security Considerations

1. **File Size Limits**: Videos are subject to 100MB upload limit
2. **Rate Limiting**: Not implemented - add rate limiting in production
3. **Resource Exhaustion**: Long videos can exhaust system resources
4. **Timeout Protection**: 5-minute timeout prevents infinite processing
5. **Format Validation**: Limited validation of video formats

## Testing

### Manual Testing

```bash
# 1. Test with short video
# Create a 10-second test video or use a sample

# 2. Enable feature
export ENABLE_EXPERIMENTAL_VIDEO=true

# 3. Upload
curl -X POST http://localhost:3000/api/media/upload \
  -F "media=@test_video.mp4"

# 4. Monitor logs
docker compose logs -f ai
docker compose logs -f backend

# 5. Verify output
curl http://localhost:3000/api/media/MEDIA_ID/depth/info
```

### Integration Test

A test script is provided (see below for creation).

## References

- [Depth Anything V2 Model](https://huggingface.co/depth-anything/Depth-Anything-V2-Small-hf)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [Main Project README](README.md)
- [Media Versions Documentation](MEDIA_VERSIONS.md)

## Support

This is an experimental feature. For issues or questions:

1. Check logs: `docker compose logs ai` and `docker compose logs backend`
2. Verify configuration in `.env` file
3. Review limitations section above
4. Open an issue on GitHub with:
   - Video file details (format, length, resolution)
   - Configuration settings
   - Error messages from logs
   - Expected vs actual behavior
