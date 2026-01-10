import React, { useState, useEffect, Suspense } from 'react';
import { Text, useTexture } from '@react-three/drei';

/**
 * TexturedMesh - Renders a textured plane (needs Suspense boundary)
 */
function TexturedMesh({ url, position }) {
  const texture = useTexture(url);
  
  return (
    <mesh position={position}>
      <planeGeometry args={[2, 2]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
}

/**
 * DepthViewer - Displays 3D depth map view of selected media
 */
function DepthViewer({ media, onClose }) {
  const [depthImageUrl, setDepthImageUrl] = useState(null);
  const [originalUrl, setOriginalUrl] = useState(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    // Load depth map URL
    if (media.depthUrl) {
      setDepthImageUrl(media.depthUrl);
    } else if (media.depthBlob) {
      const url = URL.createObjectURL(media.depthBlob);
      setDepthImageUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [media]);

  useEffect(() => {
    // Load original image URL
    if (media.originalUrl) {
      setOriginalUrl(media.originalUrl);
    } else if (media.thumbnailUrl) {
      setOriginalUrl(media.thumbnailUrl);
    }
  }, [media]);

  if (!media) return null;

  return (
    <group position={[0, 1.5, -2]}>
      {/* Original Image */}
      {originalUrl && (
        <Suspense fallback={null}>
          <TexturedMesh url={originalUrl} position={[-1.5, 0, 0]} />
        </Suspense>
      )}
      
      {/* Depth Map */}
      {depthImageUrl && (
        <Suspense fallback={null}>
          <TexturedMesh url={depthImageUrl} position={[1.5, 0, 0]} />
        </Suspense>
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
      <group 
        position={[0, 1.5, 0]}
        onClick={onClose}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        <mesh>
          <boxGeometry args={[0.5, 0.3, 0.1]} />
          <meshStandardMaterial color={hovered ? '#ff6666' : '#ff3333'} />
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
    </group>
  );
}

export default DepthViewer;
