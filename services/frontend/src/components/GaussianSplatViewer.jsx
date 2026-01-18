/**
 * GaussianSplatViewer.jsx
 * 
 * Renders 3D Gaussian Splats in VR using @sparkjsdev/spark's SplatMesh.
 * Supports .ply, .ksplat, .splat, and .spz file formats.
 * 
 * Note: Three.js is aliased to our polyfill in vite.config.js to provide
 * Matrix2 class required by SparkJS (missing in three.js < 0.178.0)
 */
import React, { useEffect, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { SplatMesh } from '@sparkjsdev/spark';

// Known-good test splat from Spark documentation
const TEST_SPLAT_URL = "https://sparkjs.dev/assets/splats/butterfly.spz";

/**
 * GaussianSplatViewer - Renders 3D Gaussian Splats using SparkJS SplatMesh
 * 
 * @param {string} splatUrl - URL to the splat file (.ply, .ksplat, .splat, .spz)
 * @param {Array} position - [x, y, z] position in 3D space
 * @param {number} scale - Uniform scale factor
 * @param {boolean} testMode - When true, loads a known-good test splat
 * @param {Function} onLoad - Callback when splat finishes loading
 * @param {Function} onError - Callback when loading fails
 */
function GaussianSplatViewer({ 
  splatUrl, 
  position = [0, 1.5, -2],
  scale = 1.0,
  testMode = false,
  onLoad,
  onError
}) {
  const { scene } = useThree();
  const splatMeshRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Store callbacks in refs to avoid stale closures
  const onLoadRef = useRef(onLoad);
  const onErrorRef = useRef(onError);
  useEffect(() => { onLoadRef.current = onLoad; }, [onLoad]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  
  const url = testMode ? TEST_SPLAT_URL : splatUrl;
  
  // Helper function to clean up SplatMesh
  const cleanupSplatMesh = () => {
    if (splatMeshRef.current) {
      scene.remove(splatMeshRef.current);
      splatMeshRef.current.dispose();
      splatMeshRef.current = null;
    }
  };
  
  // Create and manage SplatMesh lifecycle
  useEffect(() => {
    if (!url) return;
    
    console.log('[GaussianSplatViewer] Creating SplatMesh with URL:', url);
    console.log('[GaussianSplatViewer] Position:', position, 'Scale:', scale, 'TestMode:', testMode);
    
    // Clean up previous mesh if exists
    cleanupSplatMesh();
    
    // Create new SplatMesh
    const splatMesh = new SplatMesh({
      url: url,
      onLoad: (mesh) => {
        console.log('[GaussianSplatViewer] SplatMesh loaded successfully');
        setIsLoaded(true);
        if (onLoadRef.current) {
          onLoadRef.current(mesh);
        }
      }
    });
    
    // Set initial position and scale
    splatMesh.position.set(position[0], position[1], position[2]);
    splatMesh.scale.setScalar(scale);
    
    // Add to scene
    scene.add(splatMesh);
    splatMeshRef.current = splatMesh;
    
    // Handle initialization errors
    splatMesh.initialized.catch((error) => {
      console.error('[GaussianSplatViewer] Failed to load splat:', error);
      if (onErrorRef.current) {
        onErrorRef.current(error);
      }
    });
    
    // Cleanup on unmount or URL change
    return () => {
      cleanupSplatMesh();
      setIsLoaded(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, scene]);
  
  // Update position and scale when props change
  useEffect(() => {
    if (splatMeshRef.current) {
      splatMeshRef.current.position.set(position[0], position[1], position[2]);
    }
  }, [position]);
  
  useEffect(() => {
    if (splatMeshRef.current) {
      splatMeshRef.current.scale.setScalar(scale);
    }
  }, [scale]);
  
  // Return null since we're managing the mesh directly in the scene
  // (SplatMesh is added to scene imperatively, not via JSX)
  return null;
}

export default GaussianSplatViewer;
