import React, { useState, useRef, useEffect } from 'react';
import { useLoader } from '@react-three/fiber';
import { TextureLoader } from 'three';
import { Interactive } from '@react-three/xr';
import { Html } from '@react-three/drei';

/**
 * MediaThumbnail - Individual media thumbnail in VR space
 */
function MediaThumbnail({ media, position, rotation, onSelect, isSelected }) {
  const [hovered, setHovered] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);
  const meshRef = useRef();

  // Load thumbnail image
  useEffect(() => {
    // Create blob URL for the thumbnail
    if (media.thumbnailBlob) {
      const url = URL.createObjectURL(media.thumbnailBlob);
      setImageUrl(url);
      return () => URL.revokeObjectURL(url);
    } else if (media.thumbnailUrl) {
      setImageUrl(media.thumbnailUrl);
    }
  }, [media]);

  // Load texture if image URL is available
  const texture = imageUrl ? useLoader(TextureLoader, imageUrl) : null;

  const handleSelect = () => {
    if (onSelect) {
      onSelect();
    }
  };

  const scale = isSelected ? 1.2 : (hovered ? 1.1 : 1);

  return (
    <Interactive onSelect={handleSelect}>
      <group position={position} rotation={rotation}>
        <mesh
          ref={meshRef}
          scale={[scale, scale, scale]}
          onPointerEnter={() => setHovered(true)}
          onPointerLeave={() => setHovered(false)}
          onClick={handleSelect}
        >
          <planeGeometry args={[1.5, 1.5]} />
          {texture ? (
            <meshStandardMaterial map={texture} />
          ) : (
            <meshStandardMaterial color={hovered ? "#555555" : "#333333"} />
          )}
        </mesh>
        
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
    </Interactive>
  );
}

export default MediaThumbnail;
