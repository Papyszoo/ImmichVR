import React, { useState, useEffect } from 'react';
import { useLoader } from '@react-three/fiber';
import { TextureLoader } from 'three';
import { Text } from '@react-three/drei';
import { Interactive } from '@react-three/xr';

/**
 * DepthViewer - Displays 3D depth map view of selected media
 */
function DepthViewer({ media, onClose }) {
  const [depthImageUrl, setDepthImageUrl] = useState(null);
  const [depthInfo, setDepthInfo] = useState(null);

  useEffect(() => {
    // Load depth map
    if (media.depthBlob) {
      const url = URL.createObjectURL(media.depthBlob);
      setDepthImageUrl(url);
      return () => URL.revokeObjectURL(url);
    } else if (media.depthUrl) {
      setDepthImageUrl(media.depthUrl);
    }
  }, [media]);

  // Load textures
  const depthTexture = depthImageUrl ? useLoader(TextureLoader, depthImageUrl) : null;
  const originalTexture = media.originalUrl ? useLoader(TextureLoader, media.originalUrl) : null;

  if (!media) return null;

  return (
    <group position={[0, 1.5, -2]}>
      {/* Original Image */}
      {originalTexture && (
        <mesh position={[-1.5, 0, 0]}>
          <planeGeometry args={[2, 2]} />
          <meshStandardMaterial map={originalTexture} />
        </mesh>
      )}
      
      {/* Depth Map */}
      {depthTexture && (
        <mesh position={[1.5, 0, 0]}>
          <planeGeometry args={[2, 2]} />
          <meshStandardMaterial map={depthTexture} />
        </mesh>
      )}
      
      {/* Labels */}
      <Text
        position={[-1.5, -1.3, 0]}
        fontSize={0.2}
        color="white"
        anchorX="center"
      >
        Original
      </Text>
      
      <Text
        position={[1.5, -1.3, 0]}
        fontSize={0.2}
        color="white"
        anchorX="center"
      >
        Depth Map
      </Text>
      
      {/* Close Button */}
      <Interactive onSelect={onClose}>
        <group position={[0, 1.5, 0]}>
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
  );
}

export default DepthViewer;
