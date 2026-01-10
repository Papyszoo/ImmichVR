import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLoader, useFrame } from '@react-three/fiber';
import { TextureLoader } from 'three';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { Interactive, useXR } from '@react-three/xr';

/**
 * DepthViewer3D - Displays immersive 3D depth map view with displacement effect
 * Supports both photo and video frame depth maps
 */
function DepthViewer3D({ media, onClose, onNext, onPrevious }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [depthUrl, setDepthUrl] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [rotationY, setRotationY] = useState(0);
  const [loading, setLoading] = useState(true);
  const meshRef = useRef();
  const { isPresenting } = useXR();

  // Load image and depth map
  useEffect(() => {
    setLoading(true);
    
    const imageUrls = [];
    
    // Load original image
    if (media.thumbnailBlob) {
      const url = URL.createObjectURL(media.thumbnailBlob);
      setImageUrl(url);
      imageUrls.push(url);
    } else if (media.thumbnailUrl) {
      setImageUrl(media.thumbnailUrl);
    } else if (media.originalUrl) {
      setImageUrl(media.originalUrl);
    }
    
    // Load depth map
    if (media.depthBlob) {
      const url = URL.createObjectURL(media.depthBlob);
      setDepthUrl(url);
      imageUrls.push(url);
    } else if (media.depthUrl) {
      setDepthUrl(media.depthUrl);
    }
    
    setLoading(false);
    
    // Cleanup all created URLs
    return () => {
      imageUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [media]);

  // Load textures
  const imageTexture = imageUrl ? useLoader(TextureLoader, imageUrl) : null;
  const depthTexture = depthUrl ? useLoader(TextureLoader, depthUrl) : null;

  // Create displacement-mapped geometry
  const geometry = useMemo(() => {
    // Higher resolution for better depth effect (64x64 segments)
    return new THREE.PlaneGeometry(3, 3, 64, 64);
  }, []);

  // Animate rotation slightly for depth perception
  useFrame((state, delta) => {
    if (meshRef.current && isPresenting) {
      // Subtle idle animation
      meshRef.current.rotation.y = rotationY + Math.sin(state.clock.elapsedTime * 0.2) * 0.02;
    }
  });

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.2, 2.0));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.2, 0.5));
  };

  const handleRotateLeft = () => {
    setRotationY(prev => prev + 0.3);
  };

  const handleRotateRight = () => {
    setRotationY(prev => prev - 0.3);
  };

  if (!media || loading) {
    return (
      <group position={[0, 1.5, -2]}>
        <Text
          position={[0, 0, 0]}
          fontSize={0.2}
          color="white"
          anchorX="center"
        >
          Loading...
        </Text>
      </group>
    );
  }

  return (
    <group position={[0, 1.5, -3]}>
      {/* Main 3D Depth View */}
      {imageTexture && depthTexture && (
        <mesh
          ref={meshRef}
          geometry={geometry}
          scale={[zoomLevel, zoomLevel, zoomLevel]}
          rotation={[0, rotationY, 0]}
        >
          <meshStandardMaterial
            map={imageTexture}
            displacementMap={depthTexture}
            displacementScale={0.5}
            displacementBias={-0.25}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Control Panel - Bottom */}
      <group position={[0, -2.2, 0]}>
        {/* Zoom Controls */}
        <group position={[-2, 0, 0]}>
          <Interactive onSelect={handleZoomIn}>
            <group>
              <mesh>
                <boxGeometry args={[0.4, 0.3, 0.1]} />
                <meshStandardMaterial color="#4CAF50" />
              </mesh>
              <Text
                position={[0, 0, 0.06]}
                fontSize={0.15}
                color="white"
                anchorX="center"
                anchorY="middle"
              >
                Zoom +
              </Text>
            </group>
          </Interactive>
        </group>

        <group position={[-1.2, 0, 0]}>
          <Interactive onSelect={handleZoomOut}>
            <group>
              <mesh>
                <boxGeometry args={[0.4, 0.3, 0.1]} />
                <meshStandardMaterial color="#4CAF50" />
              </mesh>
              <Text
                position={[0, 0, 0.06]}
                fontSize={0.15}
                color="white"
                anchorX="center"
                anchorY="middle"
              >
                Zoom -
              </Text>
            </group>
          </Interactive>
        </group>

        {/* Rotation Controls */}
        <group position={[-0.4, 0, 0]}>
          <Interactive onSelect={handleRotateLeft}>
            <group>
              <mesh>
                <boxGeometry args={[0.4, 0.3, 0.1]} />
                <meshStandardMaterial color="#2196F3" />
              </mesh>
              <Text
                position={[0, 0, 0.06]}
                fontSize={0.15}
                color="white"
                anchorX="center"
                anchorY="middle"
              >
                ◄
              </Text>
            </group>
          </Interactive>
        </group>

        <group position={[0.4, 0, 0]}>
          <Interactive onSelect={handleRotateRight}>
            <group>
              <mesh>
                <boxGeometry args={[0.4, 0.3, 0.1]} />
                <meshStandardMaterial color="#2196F3" />
              </mesh>
              <Text
                position={[0, 0, 0.06]}
                fontSize={0.15}
                color="white"
                anchorX="center"
                anchorY="middle"
              >
                ►
              </Text>
            </group>
          </Interactive>
        </group>

        {/* Navigation Controls */}
        {onPrevious && (
          <group position={[1.2, 0, 0]}>
            <Interactive onSelect={onPrevious}>
              <group>
                <mesh>
                  <boxGeometry args={[0.4, 0.3, 0.1]} />
                  <meshStandardMaterial color="#FF9800" />
                </mesh>
                <Text
                  position={[0, 0, 0.06]}
                  fontSize={0.12}
                  color="white"
                  anchorX="center"
                  anchorY="middle"
                >
                  Prev
                </Text>
              </group>
            </Interactive>
          </group>
        )}

        {onNext && (
          <group position={[2, 0, 0]}>
            <Interactive onSelect={onNext}>
              <group>
                <mesh>
                  <boxGeometry args={[0.4, 0.3, 0.1]} />
                  <meshStandardMaterial color="#FF9800" />
                </mesh>
                <Text
                  position={[0, 0, 0.06]}
                  fontSize={0.12}
                  color="white"
                  anchorX="center"
                  anchorY="middle"
                >
                  Next
                </Text>
              </group>
            </Interactive>
          </group>
        )}
      </group>

      {/* Close Button - Top Right */}
      <group position={[2.5, 2, 0]}>
        <Interactive onSelect={onClose}>
          <group>
            <mesh>
              <boxGeometry args={[0.5, 0.3, 0.1]} />
              <meshStandardMaterial color="#ff3333" />
            </mesh>
            <Text
              position={[0, 0, 0.06]}
              fontSize={0.15}
              color="white"
              anchorX="center"
              anchorY="middle"
            >
              Close
            </Text>
          </group>
        </Interactive>
      </group>

      {/* Media Info */}
      <Text
        position={[0, 2.2, 0]}
        fontSize={0.15}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {media.originalFilename || media.original_filename || 'Media Item'}
      </Text>

      {/* Zoom Level Indicator */}
      <Text
        position={[0, -2.7, 0]}
        fontSize={0.12}
        color="#aaaaaa"
        anchorX="center"
        anchorY="middle"
      >
        Zoom: {(zoomLevel * 100).toFixed(0)}%
      </Text>
    </group>
  );
}

export default DepthViewer3D;
