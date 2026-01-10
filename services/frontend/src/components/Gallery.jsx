import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import MediaThumbnail from './MediaThumbnail';

/**
 * Gallery - Displays media items in a circular gallery layout
 */
function Gallery({ media = [], onSelect, selectedMedia }) {
  const groupRef = useRef();
  
  // Circular gallery layout
  const radius = 5;
  const itemsPerRow = 8;
  const verticalSpacing = 2;
  
  // Calculate position for each media item in a circular layout
  const getPosition = (index) => {
    const row = Math.floor(index / itemsPerRow);
    const col = index % itemsPerRow;
    const angle = (col / itemsPerRow) * Math.PI * 2;
    
    const x = Math.sin(angle) * radius;
    const z = -Math.cos(angle) * radius;
    const y = 1.5 - (row * verticalSpacing);
    
    return [x, y, z];
  };
  
  // Calculate rotation to face center
  const getRotation = (index) => {
    const col = index % itemsPerRow;
    const angle = (col / itemsPerRow) * Math.PI * 2;
    return [0, angle, 0];
  };

  return (
    <group ref={groupRef}>
      {/* Gallery Title */}
      <Text
        position={[0, 3, -3]}
        fontSize={0.5}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        ImmichVR Gallery
      </Text>
      
      {/* Instructions */}
      <Text
        position={[0, 2.5, -3]}
        fontSize={0.2}
        color="#aaaaaa"
        anchorX="center"
        anchorY="middle"
      >
        Point and select thumbnails to view in 3D
      </Text>
      
      {/* Media Items */}
      {media.length === 0 ? (
        <Text
          position={[0, 1.5, -3]}
          fontSize={0.3}
          color="#888888"
          anchorX="center"
          anchorY="middle"
        >
          No media available. Upload or import media to get started.
        </Text>
      ) : (
        media.map((item, index) => (
          <MediaThumbnail
            key={item.id || index}
            media={item}
            position={getPosition(index)}
            rotation={getRotation(index)}
            onSelect={() => onSelect(item)}
            isSelected={selectedMedia?.id === item.id}
          />
        ))
      )}
    </group>
  );
}

export default Gallery;
