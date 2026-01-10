# VR Depth Map Viewer

Immersive 3D depth map viewing experience for both photos and video frames in WebXR.

## Overview

The VR Depth Map Viewer provides an immersive way to view depth maps in virtual reality, supporting both photo and video content with interactive controls for navigation and manipulation.

## Features

### 3D Depth Rendering

- **Displacement Mapping**: Uses Three.js displacement mapping to convert 2D depth maps into 3D surfaces
- **High-Resolution Geometry**: 64x64 segment PlaneGeometry for smooth depth transitions
- **Real-Time Rendering**: Optimized for VR frame rates (72+ FPS target)
- **Double-Sided Material**: Visible from both sides for flexible viewing

### Photo Depth Maps

The `DepthViewer3D` component displays photos with depth map displacement:

- Load original image and depth map textures
- Apply displacement mapping (scale: 0.5, bias: -0.25)
- Interactive zoom and rotation controls
- Navigation between media items

### Video Frame Depth Maps (Experimental)

The `VideoDepthPlayer` component handles video frame sequences:

- Extract frames from ZIP files using jszip
- Sequential playback with configurable FPS
- Playback controls (play, pause, prev/next frame)
- Frame counter and progress display
- Same 3D displacement effect as photos

### VR Controls

#### Zoom Controls
- **Zoom In (+)**: Increase scale from 1.0x to 2.0x
- **Zoom Out (-)**: Decrease scale from 1.0x to 0.5x
- Real-time zoom level indicator

#### Rotation Controls
- **Rotate Left (◄)**: Rotate view 0.3 radians left
- **Rotate Right (►)**: Rotate view 0.3 radians right
- Subtle idle animation for depth perception

#### Navigation Controls
- **Previous**: View previous media item in gallery
- **Next**: View next media item in gallery
- **Close**: Return to gallery view

#### Video Playback Controls (Video Only)
- **Play/Pause**: Toggle automatic frame advancement
- **Previous Frame (◄)**: Go to previous frame
- **Next Frame (►)**: Go to next frame
- Frame counter display

### Performance Monitoring

The `PerformanceMonitor` component displays real-time performance metrics:

- **Current FPS**: Updated every 30 frames
- **Average FPS**: Rolling average of last 60 samples
- **Performance Rating**: Color-coded (Green: 72+, Yellow: 60+, Orange: 45+, Red: <45)
- **Toggle**: Press 'P' key to show/hide monitor

## Components

### DepthViewer3D

Displays photo depth maps with 3D displacement effect.

```jsx
import DepthViewer3D from './components/DepthViewer3D';

<DepthViewer3D
  media={mediaItem}
  onClose={handleClose}
  onNext={handleNext}
  onPrevious={handlePrevious}
/>
```

**Props:**
- `media` (object): Media item with thumbnailBlob/thumbnailUrl and depthBlob/depthUrl
- `onClose` (function): Callback when close button is clicked
- `onNext` (function, optional): Callback for next media navigation
- `onPrevious` (function, optional): Callback for previous media navigation

**Media Object Structure:**
```javascript
{
  id: 'unique-id',
  originalFilename: 'photo.jpg',
  thumbnailUrl: 'blob:...',     // or thumbnailBlob
  depthUrl: 'blob:...',          // or depthBlob
  type: 'IMAGE'
}
```

### VideoDepthPlayer

Displays video frame depth maps with playback controls.

```jsx
import VideoDepthPlayer from './components/VideoDepthPlayer';

<VideoDepthPlayer
  media={videoItem}
  onClose={handleClose}
  onNext={handleNext}
  onPrevious={handlePrevious}
/>
```

**Props:**
- `media` (object): Video media item with depthBlob (ZIP file) and metadata
- `onClose` (function): Callback when close button is clicked
- `onNext` (function, optional): Callback for next media navigation
- `onPrevious` (function, optional): Callback for previous media navigation

**Media Object Structure:**
```javascript
{
  id: 'unique-id',
  originalFilename: 'video.mp4',
  depthBlob: Blob,              // ZIP file containing frames
  type: 'video',
  metadata: {
    fps: 1,                     // Frames per second
    format: 'zip_frames'
  }
}
```

**ZIP File Structure:**
```
depth_frame_0001.png
depth_frame_0002.png
depth_frame_0003.png
...
```

### PerformanceMonitor

Displays real-time performance metrics in VR.

```jsx
import PerformanceMonitor from './components/PerformanceMonitor';

<PerformanceMonitor
  enabled={true}
  position={[-3, 3, -2]}
/>
```

**Props:**
- `enabled` (boolean): Show/hide the monitor
- `position` (array, optional): 3D position [x, y, z], default: [-3, 3, -2]

## Usage

### Basic Integration

```jsx
import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { VRButton, XR } from '@react-three/xr';
import DepthViewer3D from './components/DepthViewer3D';

function MyVRApp() {
  const [media, setMedia] = useState(null);
  
  return (
    <>
      <VRButton />
      <Canvas>
        <XR>
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} />
          
          {media && (
            <DepthViewer3D
              media={media}
              onClose={() => setMedia(null)}
            />
          )}
        </XR>
      </Canvas>
    </>
  );
}
```

### With Navigation

```jsx
function MyVRGallery({ mediaList }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % mediaList.length);
  };
  
  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + mediaList.length) % mediaList.length);
  };
  
  return (
    <DepthViewer3D
      media={mediaList[currentIndex]}
      onClose={handleClose}
      onNext={handleNext}
      onPrevious={handlePrevious}
    />
  );
}
```

### Video Playback

```jsx
function VideoViewer({ videoMedia }) {
  return (
    <VideoDepthPlayer
      media={videoMedia}
      onClose={handleClose}
    />
  );
}
```

## Technical Details

### Displacement Mapping

The depth viewer uses Three.js displacement mapping to create 3D surfaces:

```javascript
<meshStandardMaterial
  map={imageTexture}              // Color texture
  displacementMap={depthTexture}  // Depth map (grayscale)
  displacementScale={0.5}         // Displacement amount
  displacementBias={-0.25}        // Offset for centering
  side={THREE.DoubleSide}         // Render both sides
/>
```

**Parameters:**
- `displacementScale`: Controls depth intensity (0.0 = flat, 1.0 = maximum)
- `displacementBias`: Shifts displacement baseline (negative = recessed, positive = protruded)

### Geometry Optimization

High-resolution plane geometry for smooth displacement:

```javascript
const geometry = new THREE.PlaneGeometry(
  3,    // width
  3,    // height
  64,   // widthSegments (more = smoother)
  64    // heightSegments (more = smoother)
);
```

**Trade-offs:**
- Higher segments = smoother displacement but more vertices
- 64x64 (4,096 vertices) provides good balance
- Consider reducing for mobile VR (32x32 = 1,024 vertices)

### Texture Management

Proper loading and cleanup of blob URLs:

```javascript
useEffect(() => {
  const url = URL.createObjectURL(blob);
  setImageUrl(url);
  
  return () => {
    URL.revokeObjectURL(url);  // Cleanup to prevent memory leaks
  };
}, [blob]);
```

### Video Frame Extraction

Client-side ZIP extraction using jszip:

```javascript
import JSZip from 'jszip';

const zip = new JSZip();
const zipContents = await zip.loadAsync(depthBlob);

const frameFiles = Object.keys(zipContents.files)
  .filter(name => name.endsWith('.png'))
  .sort();

const frames = await Promise.all(
  frameFiles.map(async (fileName) => {
    const fileData = await zipContents.files[fileName].async('blob');
    return URL.createObjectURL(fileData);
  })
);
```

## Performance Optimization

### Frame Rate Targets

- **Oculus Quest/Quest 2**: 72 FPS minimum, 90 FPS ideal
- **High-end PC VR**: 90-120 FPS
- **Mobile VR**: 60 FPS minimum

### Optimization Strategies

1. **Reduce Geometry Complexity**
   ```javascript
   // For mobile VR
   new THREE.PlaneGeometry(3, 3, 32, 32);  // Instead of 64x64
   ```

2. **Texture Compression**
   ```javascript
   // Use lower resolution textures for distant objects
   texture.minFilter = THREE.LinearMipmapLinearFilter;
   texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
   ```

3. **Level of Detail (LOD)**
   ```javascript
   // Future enhancement
   const lod = new THREE.LOD();
   lod.addLevel(highDetailMesh, 0);
   lod.addLevel(mediumDetailMesh, 5);
   lod.addLevel(lowDetailMesh, 10);
   ```

4. **Limit Concurrent Textures**
   - Load textures on-demand
   - Unload off-screen textures
   - Use texture atlases when possible

### Performance Monitoring

Enable the performance monitor to track frame rates:

```javascript
// Press 'P' key to toggle
<PerformanceMonitor enabled={showPerformance} />
```

**Interpreting Results:**
- **Green (72+ FPS)**: Excellent performance
- **Yellow (60-72 FPS)**: Good performance
- **Orange (45-60 FPS)**: Acceptable, may cause discomfort
- **Red (<45 FPS)**: Poor, optimization needed

## Keyboard Shortcuts

- **P**: Toggle performance monitor
- **ESC**: Close viewer (browser default)

## Browser Compatibility

### VR Mode (WebXR Required)
- ✅ Chrome 90+ (with WebXR)
- ✅ Edge 90+
- ✅ Firefox Reality
- ✅ Oculus Browser
- ✅ Quest Browser
- ❌ Safari (no WebXR support)

### Fallback 2D Mode
- ✅ All modern browsers
- ✅ Chrome 80+
- ✅ Firefox 75+
- ✅ Safari 13+
- ✅ Edge 80+

## Dependencies

```json
{
  "react": "^18.2.0",
  "@react-three/fiber": "^8.15.12",
  "@react-three/drei": "^9.92.7",
  "@react-three/xr": "^6.2.3",
  "three": "^0.160.0",
  "jszip": "^3.10.1"
}
```

## Known Limitations

1. **Video Frame Extraction**: Performed client-side, may be slow for large ZIP files
2. **Memory Usage**: Each frame creates a blob URL (limit concurrent frames)
3. **Texture Size**: Large textures may cause performance issues on mobile VR
4. **ZIP Format Only**: Video frames must be in ZIP format (no streaming)
5. **No Timeline Scrubbing**: Video playback is sequential only

## Future Enhancements

- [ ] Streaming video frame delivery (avoid ZIP extraction)
- [ ] Adaptive quality based on device performance
- [ ] Hand tracking support for natural gestures
- [ ] Spatial audio for video playback
- [ ] Timeline scrubbing for videos
- [ ] Multi-user viewing sessions
- [ ] AR mode support
- [ ] Advanced depth effects (fog, parallax layers)
- [ ] Texture compression (KTX2 format)
- [ ] Level of Detail (LOD) system

## Troubleshooting

### Poor Performance

**Symptoms**: Low FPS, stuttering, lag

**Solutions:**
1. Reduce geometry segments: `PlaneGeometry(3, 3, 32, 32)`
2. Lower texture resolution
3. Close other applications
4. Reduce zoom level
5. Check device temperature

### Depth Map Not Displaying

**Symptoms**: Flat image, no 3D effect

**Solutions:**
1. Verify depth map is grayscale
2. Check `depthUrl` or `depthBlob` is provided
3. Adjust `displacementScale` (try 0.8-1.0)
4. Verify depth map resolution matches image
5. Check console for texture loading errors

### Video Frames Not Loading

**Symptoms**: "No frames available" or stuck on first frame

**Solutions:**
1. Verify ZIP file contains PNG files
2. Check file naming: `depth_frame_0001.png`, `depth_frame_0002.png`, etc.
3. Ensure ZIP is not corrupted
4. Check browser console for extraction errors
5. Verify `depthBlob` is a valid Blob object

### Controls Not Responding

**Symptoms**: Buttons don't work, can't interact

**Solutions:**
1. Ensure VR controllers are connected
2. Point controllers at buttons
3. Try using gaze-based selection
4. Check XR session is active
5. Verify @react-three/xr is properly initialized

## Support

For issues or questions:
1. Check documentation: `/services/frontend/VR_GALLERY.md`
2. Review implementation: `/services/frontend/src/components/`
3. Check video support: `/VIDEO_DEPTH_SUPPORT.md`
4. Open issue on GitHub with:
   - Device and browser information
   - Console error messages
   - Steps to reproduce
   - Expected vs actual behavior

## References

- [Three.js Displacement Mapping](https://threejs.org/docs/#api/en/materials/MeshStandardMaterial.displacementMap)
- [WebXR Device API](https://www.w3.org/TR/webxr/)
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber)
- [@react-three/xr](https://github.com/pmndrs/xr)
- [JSZip Documentation](https://stuk.github.io/jszip/)
