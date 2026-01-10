import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { VRButton, XR } from '@react-three/xr';
import { Sky, Environment } from '@react-three/drei';
import Gallery from './Gallery';
import DepthViewer3D from './DepthViewer3D';
import VideoDepthPlayer from './VideoDepthPlayer';
import PerformanceMonitor from './PerformanceMonitor';

/**
 * VRGallery - Main VR gallery container with XR support
 */
function VRGallery({ media = [], onSelectMedia }) {
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [viewerMode, setViewerMode] = useState('gallery'); // 'gallery', 'photo', 'video'
  const [showPerformance, setShowPerformance] = useState(false);

  const handleSelectMedia = (mediaItem) => {
    setSelectedMedia(mediaItem);
    
    // Determine viewer mode based on media type
    if (mediaItem.type === 'video' || mediaItem.type === 'VIDEO') {
      setViewerMode('video');
    } else {
      setViewerMode('photo');
    }
    
    if (onSelectMedia) {
      onSelectMedia(mediaItem);
    }
  };

  const handleCloseViewer = () => {
    setSelectedMedia(null);
    setViewerMode('gallery');
  };

  const handleNext = () => {
    if (!selectedMedia || media.length === 0) return;
    
    const currentIndex = media.findIndex(m => m.id === selectedMedia.id);
    const nextIndex = (currentIndex + 1) % media.length;
    handleSelectMedia(media[nextIndex]);
  };

  const handlePrevious = () => {
    if (!selectedMedia || media.length === 0) return;
    
    const currentIndex = media.findIndex(m => m.id === selectedMedia.id);
    const previousIndex = (currentIndex - 1 + media.length) % media.length;
    handleSelectMedia(media[previousIndex]);
  };

  // Toggle performance monitor with keyboard shortcut (P key)
  React.useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'p' || e.key === 'P') {
        setShowPerformance(prev => !prev);
      }
    };
    window.addEventListener('keypress', handleKeyPress);
    return () => window.removeEventListener('keypress', handleKeyPress);
  }, []);

  return (
    <>
      <VRButton />
      <Canvas>
        <XR>
          {/* Lighting */}
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          
          {/* Environment */}
          <Sky sunPosition={[100, 20, 100]} />
          <Environment preset="sunset" />
          
          {/* Performance Monitor */}
          <PerformanceMonitor enabled={showPerformance} />
          
          {/* Conditional Rendering based on viewer mode */}
          {viewerMode === 'gallery' && (
            <Gallery 
              media={media} 
              onSelect={handleSelectMedia}
              selectedMedia={selectedMedia}
            />
          )}
          
          {viewerMode === 'photo' && selectedMedia && (
            <DepthViewer3D
              media={selectedMedia}
              onClose={handleCloseViewer}
              onNext={handleNext}
              onPrevious={handlePrevious}
            />
          )}
          
          {viewerMode === 'video' && selectedMedia && (
            <VideoDepthPlayer
              media={selectedMedia}
              onClose={handleCloseViewer}
              onNext={handleNext}
              onPrevious={handlePrevious}
            />
          )}
        </XR>
      </Canvas>
    </>
  );
}

export default VRGallery;
