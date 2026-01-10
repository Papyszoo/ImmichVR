import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Text, useTexture } from '@react-three/drei';

/**
 * DepthMesh - Renders the depth-displaced image
 */
function DepthMesh({ imageUrl, depthUrl, meshRef }) {
  const [imageTexture, depthTexture] = useTexture([imageUrl, depthUrl]);
  
  const geometry = useMemo(() => {
    return new THREE.PlaneGeometry(4, 3, 64, 64);
  }, []);

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshStandardMaterial
        map={imageTexture}
        displacementMap={depthTexture}
        displacementScale={0.5}
        displacementBias={-0.25}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/**
 * ImageOnlyMesh - Shows image without depth
 */
function ImageOnlyMesh({ imageUrl, meshRef }) {
  const texture = useTexture(imageUrl);
  
  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[4, 3]} />
      <meshStandardMaterial map={texture} side={THREE.DoubleSide} />
    </mesh>
  );
}

/**
 * DepthViewer3D - Minimal immersive 3D photo viewer
 */
function DepthViewer3D({ media, onClose, onNext, onPrevious }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [depthUrl, setDepthUrl] = useState(null);
  const meshRef = useRef();

  useEffect(() => {
    if (media.thumbnailUrl) {
      setImageUrl(media.thumbnailUrl);
    } else if (media.originalUrl) {
      setImageUrl(media.originalUrl);
    } else if (media.thumbnailBlob) {
      const url = URL.createObjectURL(media.thumbnailBlob);
      setImageUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [media]);

  useEffect(() => {
    if (media.depthUrl) {
      setDepthUrl(media.depthUrl);
    } else if (media.depthBlob) {
      const url = URL.createObjectURL(media.depthBlob);
      setDepthUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [media]);

  // Gentle rotation animation
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.15) * 0.03;
    }
  });

  if (!imageUrl) {
    return (
      <group position={[0, 1.5, -2]}>
        <Text position={[0, 0, 0]} fontSize={0.2} color="white" anchorX="center">
          Loading...
        </Text>
      </group>
    );
  }

  return (
    <group position={[0, 1.6, -3]}>
      {/* Photo */}
      <Suspense fallback={
        <Text position={[0, 0, 0]} fontSize={0.2} color="white" anchorX="center">
          Loading...
        </Text>
      }>
        {depthUrl ? (
          <DepthMesh imageUrl={imageUrl} depthUrl={depthUrl} meshRef={meshRef} />
        ) : (
          <ImageOnlyMesh imageUrl={imageUrl} meshRef={meshRef} />
        )}
      </Suspense>

      {/* Minimal nav: just prev/next/close */}
      <group position={[0, -2, 0]}>
        {onPrevious && (
          <mesh position={[-1, 0, 0]} onClick={onPrevious}>
            <circleGeometry args={[0.15, 32]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.3} />
          </mesh>
        )}
        {onNext && (
          <mesh position={[1, 0, 0]} onClick={onNext}>
            <circleGeometry args={[0.15, 32]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.3} />
          </mesh>
        )}
      </group>

      {/* Close - subtle top corner */}
      <mesh position={[2.2, 1.8, 0]} onClick={onClose}>
        <circleGeometry args={[0.12, 32]} />
        <meshBasicMaterial color="#ff4444" transparent opacity={0.6} />
      </mesh>

      {/* Filename */}
      <Text
        position={[0, 2, 0]}
        fontSize={0.12}
        color="#888888"
        anchorX="center"
      >
        {media.originalFilename || media.original_filename || ''}
      </Text>
    </group>
  );
}

export default DepthViewer3D;
