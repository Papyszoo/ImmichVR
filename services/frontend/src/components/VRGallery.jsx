import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { VRButton, XR } from '@react-three/xr';
import { Sky, Environment } from '@react-three/drei';
import Gallery from './Gallery';

/**
 * VRGallery - Main VR gallery container with XR support
 */
function VRGallery({ media = [], onSelectMedia }) {
  const [selectedMedia, setSelectedMedia] = useState(null);

  const handleSelectMedia = (mediaItem) => {
    setSelectedMedia(mediaItem);
    if (onSelectMedia) {
      onSelectMedia(mediaItem);
    }
  };

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
          
          {/* Gallery Content */}
          <Gallery 
            media={media} 
            onSelect={handleSelectMedia}
            selectedMedia={selectedMedia}
          />
        </XR>
      </Canvas>
    </>
  );
}

export default VRGallery;
