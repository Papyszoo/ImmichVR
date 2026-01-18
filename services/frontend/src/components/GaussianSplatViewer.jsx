/**
 * GaussianSplatViewer.jsx
 * 
 * Renders 3D Gaussian Splats in VR using @react-three/drei's Splat component.
 */
import React, { Suspense } from 'react';
import { Splat } from '@react-three/drei';

// Known-good test splat from drei documentation
const TEST_SPLAT_URL = "https://huggingface.co/cakewalk/splat-data/resolve/main/nike.splat";

/**
 * GaussianSplatViewer - Renders 3D Gaussian Splats using drei's Splat component
 */
function GaussianSplatViewer({ 
  splatUrl, 
  position = [0, 1.5, -2],
  scale = 1.0,
  testMode = false, // Set to true to load known-good test splat
  onLoad,
  onError
}) {
  const url = testMode ? TEST_SPLAT_URL : splatUrl;
  
  if (!url) {
    return null;
  }

  console.log('[GaussianSplatViewer] Rendering drei Splat with URL:', url);
  console.log('[GaussianSplatViewer] Position:', position, 'Scale:', scale, 'TestMode:', testMode);

  return (
    <Suspense fallback={null}>
      <Splat
        src={url}
        position={position}
        scale={scale}
      />
    </Suspense>
  );
}

export default GaussianSplatViewer;
