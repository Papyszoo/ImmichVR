import React, { useState, useRef, useEffect, Suspense } from 'react';
import { useTexture, Html } from '@react-three/drei';

/**
 * ThumbnailMesh - Renders the actual textured mesh (needs Suspense boundary)
 */
function ThumbnailMesh({ imageUrl, hovered, isSelected, onClick }) {
  const texture = useTexture(imageUrl);
  const scale = isSelected ? 1.2 : (hovered ? 1.1 : 1);
  
  return (
    <mesh
      scale={[scale, scale, scale]}
      onClick={onClick}
    >
      <planeGeometry args={[1.5, 1.5]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
}

/**
 * PlaceholderMesh - Shows when image is loading or unavailable
 */
function PlaceholderMesh({ hovered, isSelected }) {
  const scale = isSelected ? 1.2 : (hovered ? 1.1 : 1);
  
  return (
    <mesh scale={[scale, scale, scale]}>
      <planeGeometry args={[1.5, 1.5]} />
      <meshStandardMaterial color={hovered ? "#555555" : "#333333"} />
    </mesh>
  );
}

/**
 * MediaThumbnail - Individual media thumbnail in VR space
 */
function MediaThumbnail({ media, position, rotation, onSelect, isSelected }) {
  const [hovered, setHovered] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);

  // Load thumbnail image
  useEffect(() => {
    // Use existing URL if available
    if (media.thumbnailUrl) {
      setImageUrl(media.thumbnailUrl);
    } else if (media.thumbnailBlob) {
      const url = URL.createObjectURL(media.thumbnailBlob);
      setImageUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [media]);

  const handleSelect = () => {
    if (onSelect) {
      onSelect();
    }
  };

  return (
    <group 
      position={position} 
      rotation={rotation}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      {imageUrl ? (
        <Suspense fallback={<PlaceholderMesh hovered={hovered} isSelected={isSelected} />}>
          <ThumbnailMesh 
            imageUrl={imageUrl} 
            hovered={hovered} 
            isSelected={isSelected}
            onClick={handleSelect}
          />
        </Suspense>
      ) : (
        <PlaceholderMesh hovered={hovered} isSelected={isSelected} />
      )}
      
      {/* Selection indicator */}
      {isSelected && (
        <mesh position={[0, 0, -0.01]}>
          <planeGeometry args={[1.6, 1.6]} />
          <meshBasicMaterial color="#00ff00" transparent opacity={0.3} />
        </mesh>
      )}
      
      {/* Media info label */}
      {hovered && (
        <Html
          position={[0, -0.9, 0]}
          center
          distanceFactor={2}
          style={{
            background: 'rgba(0,0,0,0.8)',
            color: 'white',
            padding: '5px 10px',
            borderRadius: '5px',
            fontSize: '12px',
            whiteSpace: 'nowrap',
          }}
        >
          {media.original_filename || media.originalFilename || 'Media Item'}
        </Html>
      )}
    </group>
  );
}

export default MediaThumbnail;

