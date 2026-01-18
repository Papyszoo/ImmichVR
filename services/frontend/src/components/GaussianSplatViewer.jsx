/**
 * GaussianSplatViewer.jsx
 * 
 * Renders 3D Gaussian Splats in VR using @mkkellogg/gaussian-splats-3d.
 * Optimized for Quest 3 using streaming mode and .ksplat format.
 * 
 * Supports .ply (raw), .splat, and .ksplat (optimized) formats.
 */
import React, { useEffect, useRef, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d';

/**
 * GaussianSplatViewer - Renders 3D Gaussian Splats
 * 
 * @param {string} splatUrl - URL to the .ply, .splat, or .ksplat file
 * @param {[number, number, number]} position - Position in 3D space [x, y, z]
 * @param {number} scale - Uniform scale factor
 * @param {function} onLoad - Callback when splat is loaded
 * @param {function} onError - Callback on load error
 */
function GaussianSplatViewer({ 
  splatUrl, 
  position = [0, 1.5, -2],  // Default: 1.5m high (eye level), 2m in front
  scale = 2.0,
  onLoad,
  onError
}) {
  const { scene, camera, gl } = useThree();
  const viewerRef = useRef(null);
  const loadedUrlRef = useRef(null);
  const isDisposedRef = useRef(false);
  
  // Cleanup function
  const cleanup = useCallback(() => {
    if (viewerRef.current && !isDisposedRef.current) {
      try {
        viewerRef.current.dispose();
      } catch (e) {
        console.warn('[GaussianSplatViewer] Cleanup warning:', e.message);
      }
      viewerRef.current = null;
      loadedUrlRef.current = null;
    }
  }, []);
  
  useEffect(() => {
    if (!splatUrl) {
      cleanup();
      return;
    }
    
    // Skip if already loaded this URL
    if (loadedUrlRef.current === splatUrl) {
      return;
    }
    
    // Cleanup previous viewer
    cleanup();
    isDisposedRef.current = false;
    
    console.log('[GaussianSplatViewer] Loading:', splatUrl);
    
    // Create new viewer
    const viewer = new GaussianSplats3D.Viewer({
      renderer: gl,
      camera: camera,
      selfDrivenMode: false,  // We control the render loop for VR compatibility
      useBuiltInControls: false,  // VR controllers handle movement
      sharedMemoryForWorkers: false,  // Better compatibility
    });
    
    // Load the splat scene
    viewer.addSplatScene(splatUrl, {
      scale: [scale, scale, scale],
      position: position,
      rotation: [0, 0, 0, 1],  // Quaternion: no rotation
      streamView: true,  // Important: Enable streaming for Quest 3 memory
      progressCallback: (percent, message) => {
        console.log(`[GaussianSplatViewer] Loading: ${percent.toFixed(0)}% ${message || ''}`);
      }
    })
    .then(() => {
      if (isDisposedRef.current) {
        viewer.dispose();
        return;
      }
      viewerRef.current = viewer;
      loadedUrlRef.current = splatUrl;
      console.log('[GaussianSplatViewer] Scene loaded successfully');
      onLoad?.();
    })
    .catch((err) => {
      console.error('[GaussianSplatViewer] Failed to load:', err);
      onError?.(err);
      if (!isDisposedRef.current) {
        try { viewer.dispose(); } catch (e) { /* ignore */ }
      }
    });
    
    return () => {
      isDisposedRef.current = true;
      cleanup();
    };
  }, [splatUrl, scene, camera, gl, position, scale, cleanup, onLoad, onError]);
  
  // Update viewer each frame (required for animation and rendering)
  useFrame(() => {
    if (viewerRef.current) {
      try {
        viewerRef.current.update();
        viewerRef.current.render();
      } catch (e) {
        // Silently ignore render errors during disposal
      }
    }
  });
  
  // This component doesn't render anything itself - the viewer manages scene objects
  return null;
}

export default GaussianSplatViewer;
