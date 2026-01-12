import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';
import { useThree, extend } from '@react-three/fiber';
import { ParallaxDepthMaterial, SimpleParallaxMaterial } from '../shaders/ParallaxDepthMaterial';

// Extend Three.js with our custom materials
extend({ ParallaxDepthMaterial, SimpleParallaxMaterial });

/**
 * DepthThumbnailMesh - Renders thumbnail with parallax depth effect
 * 
 * Uses parallax occlusion mapping instead of displacement for better performance:
 * - Only 4 vertices per thumbnail (flat quad)
 * - Depth calculated per-pixel in fragment shader
 * - ~256x fewer vertices than displacement approach
 * - Better visual quality at viewing distance
 */
function DepthThumbnailMesh({ 
  imageUrl, 
  depthUrl, 
  hovered, 
  onClick, 
  depthScale = 0.08, 
  targetWidth = 1.2, 
  targetHeight = 0.9,
  useSimpleParallax = false 
}) {
  const meshRef = useRef();
  const materialRef = useRef();
  
  // Load textures
  const textures = useTexture(depthUrl ? [imageUrl, depthUrl] : [imageUrl]);
  const imageTexture = Array.isArray(textures) ? textures[0] : textures;
  const depthTexture = Array.isArray(textures) && textures[1] ? textures[1] : null;
  
  // Calculate scale based on hover state
  const targetScale = hovered ? 1.05 : 1;
  
  // Simple flat geometry - no segments needed for parallax!
  const geometry = useMemo(() => {
    return new THREE.PlaneGeometry(targetWidth, targetHeight, 1, 1);
  }, [targetWidth, targetHeight]);

  // Update material uniforms when textures change
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.colorMap.value = imageTexture;
      materialRef.current.uniforms.depthMap.value = depthTexture;
      materialRef.current.uniforms.hasDepth.value = !!depthTexture;
      materialRef.current.uniforms.depthScale.value = depthScale;
    }
  }, [imageTexture, depthTexture, depthScale]);

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      scale={[targetScale, targetScale, targetScale]}
      onClick={onClick}
    >
      {useSimpleParallax ? (
        <simpleParallaxMaterial
          ref={materialRef}
          colorMap={imageTexture}
          depthMap={depthTexture}
          depthScale={depthScale}
          hasDepth={!!depthTexture}
          transparent
          side={THREE.DoubleSide}
        />
      ) : (
        <parallaxDepthMaterial
          ref={materialRef}
          colorMap={imageTexture}
          depthMap={depthTexture}
          depthScale={depthScale}
          hasDepth={!!depthTexture}
          parallaxMinLayers={4}
          parallaxMaxLayers={12}
          transparent
          side={THREE.DoubleSide}
        />
      )}
    </mesh>
  );
}

/**
 * FallbackMesh - Uses standard material when depth isn't available
 */
function FallbackMesh({ imageUrl, hovered, onClick, targetWidth, targetHeight }) {
  const meshRef = useRef();
  const texture = useTexture(imageUrl);
  const targetScale = hovered ? 1.05 : 1;
  
  return (
    <mesh
      ref={meshRef}
      scale={[targetScale, targetScale, targetScale]}
      onClick={onClick}
    >
      <planeGeometry args={[targetWidth, targetHeight, 1, 1]} />
      <meshStandardMaterial
        map={texture}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/**
 * PlaceholderMesh - Shows when image is loading
 */
function PlaceholderMesh({ hovered, width = 1.2, height = 0.9 }) {
  const scale = hovered ? 1.05 : 1;
  
  return (
    <mesh scale={[scale, scale, scale]}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial 
        color={hovered ? '#333333' : '#1a1a1a'} 
      />
    </mesh>
  );
}

/**
 * DepthThumbnail - Individual thumbnail with parallax depth effect in VR space
 * 
 * Performance characteristics:
 * - 4 vertices per thumbnail (vs 1024+ with displacement)
 * - Full resolution depth (no vertex interpolation artifacts)
 * - Adaptive quality based on distance (useSimpleParallax for far thumbnails)
 * 
 * @param {Object} photo - Photo object with thumbnailUrl, depthUrl, exifInfo, etc.
 * @param {Array} position - [x, y, z] position in 3D space
 * @param {Array} rotation - [x, y, z] rotation (optional)
 * @param {Function} onSelect - Callback when thumbnail is clicked
 * @param {number} depthScale - Parallax intensity (0.05-0.15 recommended)
 * @param {number} thumbnailHeight - Base height for thumbnails
 * @param {boolean} enableDepth - Whether to show depth effect
 * @param {boolean} useSimpleParallax - Use faster single-sample parallax
 */
function DepthThumbnail({ 
  photo, 
  position, 
  rotation = [0, 0, 0], 
  onSelect, 
  depthScale = 0.08,  // Reduced default for parallax (more sensitive than displacement)
  thumbnailHeight = 0.6,
  enableDepth = false,
  useSimpleParallax = false  // New prop for performance mode
}) {
  const [hovered, setHovered] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);
  const [depthUrl, setDepthUrl] = useState(null);

  // Calculate initial dimensions based on EXIF or ratio
  const initialDimensions = useMemo(() => {
    const exif = photo.exifInfo;
    let aspectRatio = 4/3; // Default to common photo aspect ratio
    
    // Use ratio directly if available (from timeline API)
    if (photo.ratio) {
      aspectRatio = photo.ratio;
    } else if (exif?.exifImageWidth && exif?.exifImageHeight) {
      aspectRatio = exif.exifImageWidth / exif.exifImageHeight;
    }
    
    // Clamp aspect ratio to reasonable bounds
    // Avoid extreme aspect ratios that might break layout or look bad
    // 0.5 (1:2) to 2.5 (21:9 approximately)
    if (aspectRatio < 0.5) aspectRatio = 0.5;
    if (aspectRatio > 2.5) aspectRatio = 2.5;
    
    return {
      width: thumbnailHeight * aspectRatio,
      height: thumbnailHeight
    };
  }, [photo.exifInfo, photo.ratio, thumbnailHeight]);

  // Set up image URL
  useEffect(() => {
    if (photo.thumbnailUrl) {
      setImageUrl(photo.thumbnailUrl);
    } else if (photo.thumbnailBlob) {
      const url = URL.createObjectURL(photo.thumbnailBlob);
      setImageUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [photo.thumbnailUrl, photo.thumbnailBlob]);

  // Set up depth URL from photo prop or fetch if enabled
  useEffect(() => {
    if (photo.depthUrl) {
      setDepthUrl(photo.depthUrl);
    } else if (photo.depthBlob) {
      const url = URL.createObjectURL(photo.depthBlob);
      setDepthUrl(url);
      return () => URL.revokeObjectURL(url);
    } else if (enableDepth && !depthUrl) {
      // Fetch depth if enabled and not already present
      let isActive = true;
      
      const fetchDepth = async () => {
        try {
          const { generateImmichDepth } = await import('../services/api');
          if (!isActive) return;
          
          const blob = await generateImmichDepth(photo.id);
          if (!isActive) return;
          
          const url = URL.createObjectURL(blob);
          setDepthUrl(url);
        } catch (err) {
          console.warn(`Failed to load depth for ${photo.id}`, err);
        }
      };
      
      fetchDepth();
      return () => { isActive = false; };
    } else {
      if (!enableDepth && !photo.depthUrl && !photo.depthBlob) {
        setDepthUrl(null);
      }
    }
  }, [photo.depthUrl, photo.depthBlob, enableDepth, photo.id]);

  const handleClick = (e) => {
    e.stopPropagation();
    if (onSelect) {
      onSelect(photo);
    }
  };

  // Determine if we should use depth (parallax) or fallback to simple texture
  const shouldUseParallax = imageUrl && depthUrl && enableDepth;

  return (
    <group 
      position={position} 
      rotation={rotation}
      onPointerEnter={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerLeave={(e) => {
        e.stopPropagation();
        setHovered(false);
      }}
    >
      {imageUrl ? (
        <Suspense fallback={<PlaceholderMesh hovered={hovered} width={initialDimensions.width} height={initialDimensions.height} />}>
          {shouldUseParallax ? (
            <DepthThumbnailMesh
              imageUrl={imageUrl}
              depthUrl={depthUrl}
              hovered={hovered}
              onClick={handleClick}
              depthScale={depthScale}
              targetWidth={initialDimensions.width}
              targetHeight={initialDimensions.height}
              useSimpleParallax={useSimpleParallax}
            />
          ) : (
            <FallbackMesh
              imageUrl={imageUrl}
              hovered={hovered}
              onClick={handleClick}
              targetWidth={initialDimensions.width}
              targetHeight={initialDimensions.height}
            />
          )}
        </Suspense>
      ) : (
        <PlaceholderMesh hovered={hovered} width={initialDimensions.width} height={initialDimensions.height} />
      )}
      
      {/* Hover glow effect */}
      {hovered && (
        <mesh position={[0, 0, -0.02]}>
          <planeGeometry args={[initialDimensions.width + 0.05, initialDimensions.height + 0.05]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.2} />
        </mesh>
      )}
    </group>
  );
}

export default DepthThumbnail;
