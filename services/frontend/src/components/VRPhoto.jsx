import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';
import { useThree, extend, useFrame } from '@react-three/fiber';
import { useSpring } from '@react-spring/three';
import { ParallaxDepthMaterial, SimpleParallaxMaterial } from '../shaders/ParallaxDepthMaterial';
import ErrorBoundary from './ErrorBoundary';

// Extend Three.js with our custom materials
extend({ ParallaxDepthMaterial, SimpleParallaxMaterial });

/**
 * ParallaxPhotoMesh - Renders thumbnail with parallax depth effect
 * 
 * Uses parallax occlusion mapping instead of displacement for better performance:
 * - Only 4 vertices per thumbnail (flat quad)
 * - Depth calculated per-pixel in fragment shader
 * - ~256x fewer vertices than displacement approach
 * - Better visual quality at viewing distance
 */
function ParallaxPhotoMesh({ 
  imageUrl, 
  depthUrl, 
  hovered, 
  onClick, 
  depthScale = 0.08, 
  targetWidth = 1.2, 
  targetHeight = 0.9,
  useSimpleParallax = false,
  opacity = 1.0
}) {
  const meshRef = useRef();
  const materialRef = useRef();
  
  // Load textures using useTexture
  // Note: Since this component is only rendered when depthUrl is truthy, 
  // the array length is stable (2 elements).
  const textures = useTexture([imageUrl, depthUrl]);
  const imageTexture = textures[0];
  const depthTexture = textures[1];
  
  // Configure textures for NPOT support (prevent WebGL errors)
  useEffect(() => {
    // DEBUG LOGGING
    console.log('[DepthThumbnailMesh] Textures loaded:', { 
      img: imageTexture, 
      depth: depthTexture,
      imgFormat: imageTexture?.format,
      depthFormat: depthTexture?.format,
      imgImage: imageTexture?.image,
    });

    if (imageTexture) {
      imageTexture.minFilter = THREE.LinearFilter;
      imageTexture.generateMipmaps = false;
      imageTexture.wrapS = THREE.ClampToEdgeWrapping;
      imageTexture.wrapT = THREE.ClampToEdgeWrapping;
      imageTexture.needsUpdate = true;
    }
    if (depthTexture) {
      depthTexture.minFilter = THREE.LinearFilter;
      depthTexture.generateMipmaps = false;
      depthTexture.wrapS = THREE.ClampToEdgeWrapping;
      depthTexture.wrapT = THREE.ClampToEdgeWrapping;
      depthTexture.needsUpdate = true;
    }
  }, [imageTexture, depthTexture]);
  
  // Calculate scale based on hover state
  const targetScale = hovered ? 1.05 : 1;
  
  // Simple flat geometry - no segments needed for parallax!
  const geometry = useMemo(() => {
    return new THREE.PlaneGeometry(targetWidth, targetHeight, 1, 1);
  }, [targetWidth, targetHeight]);

  // Animate depth scale on mount/change
  const { animatedDepthScale } = useSpring({
    animatedDepthScale: depthScale,
    from: { animatedDepthScale: 0 },
    config: { tension: 120, friction: 14 }
  });

  // Update uniforms per frame for smooth animation
  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.depthScale.value = animatedDepthScale.get();
    }
  });

  // Update other uniforms when textures change
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.colorMap.value = imageTexture;
      materialRef.current.uniforms.depthMap.value = depthTexture;
      materialRef.current.uniforms.hasDepth.value = !!depthTexture;
      if (materialRef.current.uniforms.opacity) {
        materialRef.current.uniforms.opacity.value = opacity;
      }
    }
  }, [imageTexture, depthTexture, opacity]);

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
          opacity={opacity}
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
          opacity={opacity}
          side={THREE.DoubleSide}
        />
      )}
    </mesh>
  );
}

/**
 * FallbackMesh - Uses standard material when depth isn't available
 */
function FallbackMesh({ imageUrl, hovered, onClick, targetWidth, targetHeight, ...props }) {
  const meshRef = useRef();
  const texture = useTexture(imageUrl);
  const targetScale = hovered ? 1.05 : 1;
  // FallbackMesh opacity support
  const opacity = props.opacity !== undefined ? props.opacity : 1.0;
  
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
        transparent={opacity < 1.0}
        opacity={opacity}
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
 * ErrorMesh - Shows when image failed to load
 */
function ErrorMesh({ width = 1.2, height = 0.9 }) {
  return (
    <mesh>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial color="#500000" /> {/* Dark red for error */}
    </mesh>
  );
}

/**
 * VRPhoto - Individual thumbnail with parallax depth effect in VR space
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
function VRPhoto({ 
  photo, 
  position, 
  rotation = [0, 0, 0], 
  onSelect, 
  depthScale = 0.08,  // Reduced default for parallax (more sensitive than displacement)
  thumbnailHeight = 0.6,
  enableDepth = false,
  useSimpleParallax = false,  // New prop for performance mode
  opacity = 1.0,
  loadFullQuality = false // New prop to trigger full quality load
}) {
  const [hovered, setHovered] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);
  const [depthUrl, setDepthUrl] = useState(null);
  const [fullQualityLoaded, setFullQualityLoaded] = useState(false);

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
    // If we've already loaded full quality for this photo ID, don't revert to thumbnail
    if (fullQualityLoaded && imageUrl) return;

    if (photo.thumbnailUrl) {
      setImageUrl(photo.thumbnailUrl);
    } else if (photo.thumbnailBlob) {
      const url = URL.createObjectURL(photo.thumbnailBlob);
      setImageUrl(url);
      return () => URL.revokeObjectURL(url);
    } else if (photo.id) {
        // OPTIMIZATION: Use direct URL to enable browser caching
        // The backend proxy handles this route
        const url = `/api/immich/assets/${photo.id}/thumbnail?size=thumbnail`;
        setImageUrl(url);
        // No cleanup needed for string URLs
    }
  }, [photo.thumbnailUrl, photo.thumbnailBlob, photo.id, fullQualityLoaded]);

  // Load full quality image if requested
  useEffect(() => {
    if (loadFullQuality && !fullQualityLoaded) {
      let isActive = true;
      const loadFull = async () => {
        try {
          const { getImmichFile } = await import('../services/api');
          if (!isActive) return;
          
          // Check if we can get the file
          const blob = await getImmichFile(photo.id);
          if (!isActive) return;
          
          const url = URL.createObjectURL(blob);
          setImageUrl(url);
          setFullQualityLoaded(true);
          
          // Cleanup function for this specific URL when component unmounts or URL changes
          return () => URL.revokeObjectURL(url);
        } catch (err) {
          console.warn(`Failed to load full quality image for ${photo.id}`, err);
        }
      };
      
      loadFull();
      return () => { isActive = false; };
    } else if (!loadFullQuality && fullQualityLoaded) {
       // Reset if deselected? Maybe keep it cached? 
       // For now, let's keep it if loaded to avoid flickering if quickly reselected
    }
  }, [loadFullQuality, photo.id, fullQualityLoaded]);

  // Set up depth URL from photo prop or fetch if enabled
  useEffect(() => {
    if (photo.depthUrl) {
      setDepthUrl(photo.depthUrl);
    } else if (photo.depthBlob) {
      const url = URL.createObjectURL(photo.depthBlob);
      setDepthUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
        setDepthUrl(null);
    }
  }, [photo.depthUrl, photo.depthBlob, photo.id]);

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
        <ErrorBoundary fallback={<ErrorMesh width={initialDimensions.width} height={initialDimensions.height} />}>
          <Suspense fallback={<PlaceholderMesh hovered={hovered} width={initialDimensions.width} height={initialDimensions.height} />}>
            {shouldUseParallax ? (
              <ParallaxPhotoMesh
                imageUrl={imageUrl}
                depthUrl={depthUrl}
                hovered={hovered}
                onClick={handleClick}
                depthScale={depthScale}
                targetWidth={initialDimensions.width}
                targetHeight={initialDimensions.height}
                useSimpleParallax={useSimpleParallax}
                opacity={opacity}
              />
            ) : (
              <FallbackMesh
                imageUrl={imageUrl}
                hovered={hovered}
                onClick={handleClick}
                targetWidth={initialDimensions.width}
                targetHeight={initialDimensions.height}
                opacity={opacity}
              />
            )}
          </Suspense>
        </ErrorBoundary>
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

export default VRPhoto;
