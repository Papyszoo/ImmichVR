# React WebXR Frontend - VR Gallery

This document describes the React-based WebXR frontend for ImmichVR, built with Vite, React Three Fiber, and @react-three/xr.

## Overview

The frontend provides an immersive VR gallery experience for browsing media and viewing 3D depth maps. It includes both VR and non-VR fallback modes.

## Technology Stack

- **Vite**: Fast build tool and development server
- **React 18**: UI framework
- **React Three Fiber**: React renderer for Three.js
- **@react-three/xr**: WebXR support for VR experiences
- **@react-three/drei**: Helper components for Three.js
- **Three.js**: 3D graphics library
- **Axios**: HTTP client for API calls

## Architecture

### Components

#### VRGallery.jsx
Main VR gallery container that sets up the WebXR session with:
- VR button to enter VR mode
- Canvas with XR context
- Lighting and environment setup
- Gallery content rendering

#### Gallery.jsx
Displays media items in a circular gallery layout:
- Circular arrangement with configurable radius
- Multiple rows for large collections
- Title and instructions
- Media thumbnail grid

#### MediaThumbnail.jsx
Individual media thumbnail in VR space:
- Interactive selection with pointer
- Hover effects with scaling
- Thumbnail image loading
- Selection indicators
- Info labels on hover

#### DepthViewer.jsx
3D depth map viewer for selected media:
- Side-by-side original and depth map display
- Interactive close button
- Texture loading for both images

#### FallbackGallery.jsx
2D fallback UI for non-VR browsers:
- Responsive grid layout
- Thumbnail browsing
- Media selection and viewing
- Side-by-side depth map display
- VR capability notification

### Services

#### api.js
Backend API integration module:
- Media status retrieval
- Depth map fetching
- Immich asset integration
- File uploads
- Health checks

## Features

### VR Mode Features

1. **Circular Gallery Layout**
   - Media items arranged in a circular pattern
   - Multiple rows for large collections
   - Face-center orientation for easy viewing

2. **Interactive Selection**
   - Pointer-based interaction
   - Hover effects with visual feedback
   - Click/select to view details

3. **VR Navigation**
   - Head tracking for natural navigation
   - Controller/pointer support
   - Gaze-based interaction

4. **3D Depth Map Viewing**
   - Immersive depth map display
   - Side-by-side comparison
   - Interactive controls

### Non-VR Mode Features

1. **Responsive Grid Layout**
   - Adaptive grid for different screen sizes
   - Touch-friendly interface
   - Keyboard navigation support

2. **Media Browsing**
   - Thumbnail grid view
   - Click to view full media
   - Back navigation

3. **Depth Map Display**
   - Side-by-side view
   - Responsive images
   - Download support

## API Integration

The frontend connects to the backend API endpoints:

### Media Endpoints
- `GET /api/media/status` - List all media items
- `GET /api/media/:id/depth` - Fetch depth map
- `GET /api/media/:id/depth/info` - Get depth map metadata
- `POST /api/media/upload` - Upload media files

### Immich Integration (Optional)
- `GET /api/immich/photos` - List Immich photos
- `GET /api/immich/assets/:id/thumbnail` - Fetch thumbnails
- `GET /api/immich/assets/:id/file` - Fetch full resolution

## Configuration

### Environment Variables

Create a `.env` file in the frontend directory:

```env
# Backend API URL (optional, defaults to /api)
VITE_API_URL=http://localhost:3000/api
```

### Vite Configuration

The `vite.config.js` configures:
- React plugin for JSX support
- Development server on port 3000
- Build output to `build/` directory
- Source maps for debugging

## Development

### Install Dependencies

```bash
cd services/frontend
npm install
```

### Start Development Server

```bash
npm run dev
```

The dev server starts at `http://localhost:3000` (or next available port).

### Build for Production

```bash
npm run build
```

Outputs to `build/` directory.

### Preview Production Build

```bash
npm run preview
```

## VR Testing

### Browser Requirements

WebXR is supported in:
- Chrome/Edge (with WebXR Device API)
- Firefox Reality
- Oculus Browser
- Quest Browser

### Testing Without VR Hardware

1. Use Chrome with WebXR Emulator Extension
2. Firefox with WebXR API Emulator
3. The fallback 2D mode automatically activates

### Testing With VR Hardware

1. Connect VR headset
2. Open application in VR-compatible browser
3. Click "Enter VR" button
4. Use controllers to navigate and select

## Deployment

The frontend is containerized with Docker:

### Build Docker Image

```bash
docker build -t immichvr-frontend services/frontend
```

### Run Container

```bash
docker run -p 80:80 immichvr-frontend
```

### Docker Compose

The frontend is included in the main `docker-compose.yml`:

```bash
docker compose up frontend
```

## Browser Compatibility

### VR Mode
- Chrome 90+ (WebXR support)
- Edge 90+
- Firefox Reality
- Oculus Browser
- Quest Browser

### Non-VR Mode
- All modern browsers
- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Performance Considerations

### 3D Assets
- Textures are loaded asynchronously
- Thumbnails cached in browser
- LOD (Level of Detail) for large collections

### Optimization
- Code splitting for faster initial load
- Lazy loading of components
- Efficient texture management
- Memory cleanup on unmount

## Known Limitations

1. **Large Collections**: Performance may degrade with 100+ items
2. **Texture Size**: Large images may take time to load
3. **Mobile VR**: Limited controller support on some devices
4. **Browser Support**: WebXR not available in all browsers

## Future Enhancements

- [ ] Advanced VR controls (teleportation, grab)
- [ ] Hand tracking support
- [ ] Spatial audio integration
- [ ] Multi-user VR sessions
- [ ] AR mode support
- [ ] 3D model viewing
- [ ] Video playback in VR
- [ ] Gesture controls

## Troubleshooting

### VR Button Not Appearing
- Check browser WebXR support
- Verify HTTPS connection (required for WebXR)
- Check console for errors

### Thumbnails Not Loading
- Verify backend API is running
- Check network tab for failed requests
- Verify media files exist

### Build Failures
- Clear node_modules and reinstall
- Check Node.js version (18+ required)
- Verify all dependencies installed

## Contributing

When contributing to the VR frontend:

1. Test in both VR and non-VR modes
2. Verify mobile responsiveness
3. Check performance with large datasets
4. Follow React best practices
5. Update documentation for new features
