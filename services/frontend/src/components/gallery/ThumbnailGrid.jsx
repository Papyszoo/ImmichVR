import React, { useMemo } from 'react';
import { Text } from '@react-three/drei';
import VRPhoto from '../VRPhoto';

/**
 * ThumbnailGrid - The 3D grid of depth thumbnails with flex-like row layout
 */
function ThumbnailGrid({ 
  photos, 
  onSelectPhoto, 
  settings, 
  setSettings, 
  settingsOpen, 
  setSettingsOpen,
  scrollY,
  depthCache = {},
  groupPositions,
  setGroupPositions
}) {
  const { galleryWidth, thumbnailHeight, wallCurvature, wallDistance, gap, depthScale } = settings;
  
  // Calculate layout (flex-like wrapping)
  const allItems = useMemo(() => {
    // Group photos by date
    const dateGroups = [];
    let currentGroup = null;
    
    photos.forEach(photo => {
      const dateStr = photo.fileCreatedAt || photo.localDateTime || photo.createdAt;
      const date = dateStr ? new Date(dateStr) : new Date();
      const key = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      const year = date.getFullYear();
      
      if (!currentGroup || currentGroup.label !== key) {
        currentGroup = {
          label: key,
          year: year,
          photos: []
        };
        dateGroups.push(currentGroup);
      }
      currentGroup.photos.push(photo);
    });
    
    const items = [];
    const headers = [];
    const newGroupPositions = {};
    
    let globalY = 1.2; // Starting Y position
    const rowHeight = thumbnailHeight + gap;
    const headerHeight = 0.3; // Height for date headers
    
    dateGroups.forEach((group) => {
      // Record the Y position for this group (for timeline navigation)
      newGroupPositions[group.label] = { y: globalY, year: group.year };
      
      // Add header row
      headers.push({
        label: group.label,
        position: [0, globalY, -wallDistance], // Centered initially (curved later)
        year: group.year
      });
      globalY -= headerHeight;
      
      // Layout photos in rows
      let currentRow = [];
      let currentRowWidth = 0;
      
      group.photos.forEach((photo, index) => {
        // Calculate thumbnail width based on aspect ratio
        const exif = photo.exifInfo;
        let aspectRatio = 1;
        if (photo.ratio) {
          aspectRatio = photo.ratio;
        } else if (exif?.exifImageWidth && exif?.exifImageHeight) {
          aspectRatio = exif.exifImageWidth / exif.exifImageHeight;
        }
        aspectRatio = Math.max(0.5, Math.min(2.5, aspectRatio));
        
        const thumbWidth = thumbnailHeight * aspectRatio;
        const itemWidth = thumbWidth + gap;
        
        if (currentRowWidth + itemWidth > galleryWidth && currentRow.length > 0) {
          // Finalize current row
          processRow(currentRow, currentRowWidth, globalY, items, galleryWidth, wallDistance, wallCurvature, depthCache);
          globalY -= rowHeight;
          currentRow = [];
          currentRowWidth = 0;
        }
        
        currentRow.push({ photo, width: thumbWidth, aspectRatio });
        currentRowWidth += itemWidth;
      });
      
      // Finalize last row of group
      if (currentRow.length > 0) {
        processRow(currentRow, currentRowWidth, globalY, items, galleryWidth, wallDistance, wallCurvature, depthCache);
        globalY -= rowHeight;
      }
      
      // Gap between groups
      globalY -= 0.2;
    });
    
    // Update group positions state if changed
    // Note: We avoid calling setGroupPositions directly in render loop to avoid resizing loops
    // Instead we rely on the parent to update this when needed or via useEffect
    if (JSON.stringify(newGroupPositions) !== JSON.stringify(groupPositions)) {
      setTimeout(() => setGroupPositions(newGroupPositions), 0);
    }
    
    return { items, headers };
  }, [photos, galleryWidth, thumbnailHeight, gap, wallDistance, wallCurvature, depthCache]);
  
  // Helper to position items in a row
  function processRow(row, width, y, items, galleryWidth, wallDistance, wallCurvature, depthCache) {
    const startX = -width / 2;
    let currentX = startX;
    
    row.forEach(item => {
      const x = currentX + item.width / 2;
      
      // Apply curvature
      let finalX = x;
      let finalZ = -wallDistance;
      let rotationY = 0;
      
      if (wallCurvature > 0) {
        // arcLength = angle * radius, so angle = arcLength / radius
        const arcAngle = (x / wallDistance) * wallCurvature;
        
        // Position on the curved wall
        finalX = Math.sin(arcAngle) * wallDistance;
        finalZ = -Math.cos(arcAngle) * wallDistance;
        rotationY = arcAngle;
      }
      
      items.push({
        ...item,
        position: [finalX, y, finalZ],
        rotation: [0, rotationY, 0],
        depthUrl: depthCache[item.photo.id]
      });
      
      currentX += item.width + gap;
    });
  }

  // Filter to only visible items based on camera position
  const visibleData = useMemo(() => {
    // Camera is static at ~1.6m (eye level)
    // The world moves by -scrollY, so an item at y=10 with scrollY=10 becomes y=0 (visible)
    const cameraY = 1.6;
    const viewHeight = 4; // Visible height buffer around camera
    const cameraPos = [0, cameraY, 0];
    
    const visibleItems = allItems.items.filter(item => {
      // Calculate effective position in world space after scroll group offset
      const worldY = item.position[1] - scrollY;
      return worldY > cameraY - viewHeight && worldY < cameraY + viewHeight;
    }).map(item => {
      // Calculate actual distance from camera for LOD
      // We need effective world position for distance calc
      const worldY = item.position[1] - scrollY;
      
      const dx = item.position[0] - cameraPos[0];
      const dy = worldY - cameraPos[1];
      const dz = item.position[2] - cameraPos[2];
      const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
      
      return {
        ...item,
        distance,
        // Use simple parallax for items farther than 2.5m
        useSimpleParallax: distance > 2.5
      };
    });
    
    const visibleHeaders = allItems.headers.filter(header => {
      const worldY = header.position[1] - scrollY;
      return worldY > cameraY - viewHeight && worldY < cameraY + viewHeight;
    });
    
    return { items: visibleItems, headers: visibleHeaders };
  }, [allItems, scrollY]);

  return (
    <group position={[0, -scrollY, 0]}>
      {/* Title */}
      <Text
        position={[0, 2.0, -wallDistance]}
        fontSize={0.2}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
      >
        VR Photo Gallery
      </Text>
      
      {/* Photo count */}
      <Text
        position={[0, 1.8, -wallDistance]}
        fontSize={0.08}
        color="#666666"
        anchorX="center"
        anchorY="middle"
      >
        {photos.length} photos - {visibleData.items.length} visible
      </Text>
      
      {/* Date headers */}
      {visibleData.headers.map((header) => (
        <Text
          key={header.label}
          position={header.position}
          fontSize={0.12}
          color="#888888"
          anchorX="center"
          anchorY="middle"
        >
          {header.label}
        </Text>
      ))}

      {/* Thumbnails */}
      {visibleData.items.map(({ photo, position, rotation, depthUrl, useSimpleParallax }) => (
        <VRPhoto
          key={photo.id}
          photo={{ ...photo, depthUrl }}
          position={position}
          rotation={rotation}
          onSelect={(p) => !settingsOpen && onSelectPhoto(p, position, rotation)}
          depthScale={depthScale}
          thumbnailHeight={thumbnailHeight}
          enableDepth={false} // Force disable depth for grid thumbnails
          useSimpleParallax={useSimpleParallax}
        />
      ))}
    </group>
  );
}

export default ThumbnailGrid;
