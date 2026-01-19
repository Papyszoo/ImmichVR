/**
 * GaussianSplatViewer.jsx
 * 
 * Renders 3D Gaussian Splats in VR using @sparkjsdev/spark's SplatMesh.
 * Supports .ply, .ksplat, and .spz file formats. 
 * Note: .splat format is deprecated - use PLY (SparkJS loads natively) or KSPLAT.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { SplatMesh, SplatLoader, SplatFileType } from '@sparkjsdev/spark';

// Known-good test splat from Spark documentation
const TEST_SPLAT_URL = "https://sparkjs.dev/assets/splats/butterfly.spz";

// Map string fileType values to SparkJS SplatFileType enum
const FILE_TYPE_MAP = {
  'ply': SplatFileType.PLY,
  'ksplat': SplatFileType.KSPLAT,
  'splat': SplatFileType.SPLAT,
  'spz': SplatFileType.SPZ,
};

/**
 * GaussianSplatViewer - Renders 3D Gaussian Splats using SparkJS SplatMesh
 * 
 * @param {string} splatUrl - URL to the splat file (.ply, .ksplat, .splat, .spz)
 * @param {string} fileType - Explicit file type for blob URLs ('ply', 'ksplat', 'splat', 'spz')
 * @param {Array} position - [x, y, z] position in 3D space
 * @param {Array} rotation - [x, y, z] rotation in radians
 * @param {number} scale - Uniform scale factor
 * @param {boolean} testMode - When true, loads a known-good test splat
 * @param {Function} onLoad - Callback when splat finishes loading
 * @param {Function} onError - Callback when loading fails
 */
function GaussianSplatViewer({ 
  splatUrl, 
  fileType,
  quality = 'HIGH', // Default to HIGH
  position = [0, 1.5, -2],
  rotation = [0, 0, 0],
  scale = 1.0,
  testMode = false,
  onLoad,
  onError
}) {
  const { scene } = useThree();
  const splatMeshRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [splatCount, setSplatCount] = useState(0);
  
  // Store callbacks in refs to avoid stale closures
  const onLoadRef = useRef(onLoad);
  const onErrorRef = useRef(onError);
  useEffect(() => { onLoadRef.current = onLoad; }, [onLoad]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  
  const url = testMode ? TEST_SPLAT_URL : splatUrl;
  
  // React to Quality Changes (Performance Optimization)
  useEffect(() => {
    const mesh = splatMeshRef.current;
    if (mesh) {
        if (quality === 'LOW') {
            console.log("GaussianSplatViewer: Optimizing for LOW quality");
            // OPTIMIZATION: Reduce overdraw buffer
            // maxStdDev controls how "wide" a splat can be drawn. 
            // Reducing it reduces GPU fill rate pressure.
            // Note: SparkJS SplatMesh exposes this as a property that updates uniforms
            if (mesh.material) {
                 mesh.maxStdDev = 2.0; 
            }
        } else {
            console.log("GaussianSplatViewer: Resetting to HIGH quality");
            // Reset to default (approx 3.0)
            if (mesh.material) {
                mesh.maxStdDev = 3.0; 
            }
        }
    }
  }, [quality]);
  
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
    
    // Convert string fileType to SparkJS enum
    const splatFileType = fileType ? FILE_TYPE_MAP[fileType.toLowerCase()] : undefined;
    
    console.log('[GaussianSplatViewer] Creating SplatMesh with URL:', url);
    console.log('[GaussianSplatViewer] FileType:', fileType, '-> SplatFileType:', splatFileType);
    console.log('[GaussianSplatViewer] Position:', position, 'Rotation:', rotation, 'Scale:', scale, 'TestMode:', testMode, 'Quality:', quality);
    
    // Clean up previous mesh if exists
    cleanupSplatMesh();
    
    // For non-auto-detectable formats (ksplat, splat), use SplatLoader with explicit fileType
    if (splatFileType && (splatFileType === SplatFileType.KSPLAT || splatFileType === SplatFileType.SPLAT)) {
      console.log('[GaussianSplatViewer] Using SplatLoader with explicit fileType:', splatFileType);
      
      const loader = new SplatLoader();
      loader.fileType = splatFileType; // Set fileType BEFORE loading
      
      loader.loadAsync(url)
        .then((packedSplats) => {
          console.log('[GaussianSplatViewer] SplatLoader loaded successfully, creating SplatMesh');
          
          const splatMesh = new SplatMesh({ packedSplats });
          
          // Set position, rotation and scale
          splatMesh.position.set(position[0], position[1], position[2]);
          splatMesh.rotation.set(rotation[0], rotation[1], rotation[2]);
          splatMesh.scale.setScalar(scale);
          
          // Apply initial quality settings
          if (quality === 'LOW') splatMesh.maxStdDev = 2.0;

          // Add to scene
          scene.add(splatMesh);
          splatMeshRef.current = splatMesh;
          
          setIsLoaded(true);
          
          // Get splat count from packedSplats
          const count = packedSplats?.size || packedSplats?.numSplats || 0;
          setSplatCount(count);
          console.log('[GaussianSplatViewer] Splat count:', count);
          
          if (onLoadRef.current) {
            onLoadRef.current(splatMesh, count);
          }
        })
        .catch((error) => {
          console.error('[GaussianSplatViewer] SplatLoader failed:', error);
          if (onErrorRef.current) {
            onErrorRef.current(error);
          }
        });
    } else {
      // For auto-detectable formats (ply, spz), use SplatMesh directly
      console.log('[GaussianSplatViewer] Using SplatMesh directly for auto-detectable format');
      
      const splatMesh = new SplatMesh({
        url: url,
        onLoad: (mesh) => {
          console.log('[GaussianSplatViewer] SplatMesh loaded successfully');
          console.log('[GaussianSplatViewer] Mesh properties:', Object.keys(mesh || {}));
          setIsLoaded(true);
          
          // Apply initial quality settings
          if (quality === 'LOW') mesh.maxStdDev = 2.0;

          // Try multiple sources for splat count
          // SparkJS stores splat data in packedSplats after loading
          const count = mesh?.packedSplats?.size 
            || mesh?.packedSplats?.numSplats 
            || mesh?.numSplats
            || mesh?.geometry?.attributes?.position?.count 
            || 0;
          setSplatCount(count);
          console.log('[GaussianSplatViewer] Splat count:', count);
          
          if (onLoadRef.current) {
            onLoadRef.current(mesh, count);
          }
        }
      });
      
      // Set initial position, rotation and scale
      splatMesh.position.set(position[0], position[1], position[2]);
      splatMesh.rotation.set(rotation[0], rotation[1], rotation[2]);
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
    }
    
    // Cleanup on unmount or URL change
    return () => {
      cleanupSplatMesh();
      setIsLoaded(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, fileType, scene]); // Note: excluding 'quality' from dependency array to prevent reload on quality change (handled by effect above)
  
  // ... rest of property updates (position, rotation, scale) ... 
  
  // Update position when props change
  useEffect(() => {
    if (splatMeshRef.current) {
      splatMeshRef.current.position.set(position[0], position[1], position[2]);
    }
  }, [position]);
  
  // Update rotation when props change
  useEffect(() => {
    if (splatMeshRef.current) {
      splatMeshRef.current.rotation.set(rotation[0], rotation[1], rotation[2]);
    }
  }, [rotation]);
  
  // Update scale when props change
  useEffect(() => {
    if (splatMeshRef.current) {
      splatMeshRef.current.scale.setScalar(scale);
    }
  }, [scale]);
  
  // Return null since we're managing the mesh directly in the scene
  return null;
}

export default GaussianSplatViewer;




