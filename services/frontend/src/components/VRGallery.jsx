import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { createXRStore, XR } from '@react-three/xr';
import { Sky, Environment } from '@react-three/drei';
import DepthViewer3D from './DepthViewer3D';

// Create XR store for managing VR sessions
const xrStore = createXRStore();

// Export store for external access
if (typeof window !== 'undefined') {
  window.xrStore = xrStore;
}

/**
 * VRGallery - 3D viewer for a single photo with depth effect
 */
function VRGallery({ media = [], selectedMedia, onClose, onNext, onPrevious }) {
  const currentMedia = selectedMedia || media[0];

  if (!currentMedia) {
    return null;
  }

  return (
    <div style={styles.container}>
      {/* Back button */}
      <button onClick={onClose} style={styles.backButton}>
        ← Back to Gallery
      </button>

      {/* VR Button */}
      <button onClick={() => xrStore.enterVR()} style={styles.vrButton}>
        🥽 Enter VR
      </button>

      {/* Navigation */}
      <div style={styles.nav}>
        <button onClick={onPrevious} style={styles.navButton}>←</button>
        <span style={styles.filename}>
          {currentMedia.originalFilename || currentMedia.originalFileName || 'Photo'}
        </span>
        <button onClick={onNext} style={styles.navButton}>→</button>
      </div>

      {/* 3D Canvas */}
      <Canvas style={styles.canvas}>
        <XR store={xrStore}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 5, 5]} intensity={0.8} />
          <Sky sunPosition={[100, 20, 100]} />
          <Environment preset="sunset" />
          
          <DepthViewer3D
            media={currentMedia}
            onClose={onClose}
            onNext={onNext}
            onPrevious={onPrevious}
          />
        </XR>
      </Canvas>
    </div>
  );
}

const styles = {
  container: {
    position: 'relative',
    width: '100vw',
    height: '100vh',
    backgroundColor: '#000000',
  },
  canvas: {
    width: '100%',
    height: '100%',
  },
  backButton: {
    position: 'absolute',
    top: '16px',
    left: '16px',
    zIndex: 100,
    padding: '10px 16px',
    fontSize: '14px',
    backgroundColor: 'rgba(0,0,0,0.6)',
    color: 'white',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '8px',
    cursor: 'pointer',
    backdropFilter: 'blur(8px)',
  },
  vrButton: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    zIndex: 100,
    padding: '10px 16px',
    fontSize: '14px',
    backgroundColor: 'rgba(76, 175, 80, 0.9)',
    color: 'white',
    border: 'none',
    borderRadius: '20px',
    cursor: 'pointer',
  },
  nav: {
    position: 'absolute',
    bottom: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '8px 16px',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: '24px',
    backdropFilter: 'blur(8px)',
  },
  navButton: {
    width: '36px',
    height: '36px',
    fontSize: '18px',
    backgroundColor: 'rgba(255,255,255,0.1)',
    color: 'white',
    border: 'none',
    borderRadius: '50%',
    cursor: 'pointer',
  },
  filename: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.8)',
    maxWidth: '200px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
};

export default VRGallery;
