import { useSpring } from '@react-spring/three';

export const VIEWER_CONFIG = {
  adjacentPhotosCount: 2,  // Show 2 prev + 2 next
  animationDuration: 0.5,  // seconds
  selectedPhotoScale: 3,   // Scale factor for selected photo
  adjacentPhotoScale: 0.5, // Scale for side thumbnails
  selectedPosition: [0, 1.6, -2],
  sideOffset: 1.5,
  sideZ: -2.5,
};

/**
 * Hook to handle animation for photos in the viewer
 * @param {boolean} isSelected - Whether this photo is the currently selected one
 * @param {number} offsetIndex - Distance from selected photo (0 = selected, -1 = left, 1 = right)
 * @param {boolean} isVisible - Whether the viewer is active
 */
export function usePhotoViewerAnimation(isSelected, offsetIndex, isVisible) {
  
  // Calculate target state
  const getTargetState = () => {
    if (!isVisible) {
      // Transition out state (could be modified to match grid position if passed)
      return {
        position: [0, 1.6, -5],
        scale: 0,
        opacity: 0,
      };
    }

    if (isSelected) {
      // Selected photo state
      return {
        position: VIEWER_CONFIG.selectedPosition,
        scale: VIEWER_CONFIG.selectedPhotoScale,
        opacity: 1,
      };
    }

    // Adjacent photos
    const isAdjacent = Math.abs(offsetIndex) <= VIEWER_CONFIG.adjacentPhotosCount;
    
    if (isAdjacent) {
      const direction = Math.sign(offsetIndex);
      // Position adjacent photos to the sides
      // 1 -> 1.5, 2 -> 3.0, etc.
      const x = direction * (1.5 + (Math.abs(offsetIndex) - 1) * 0.5); 
      // Or simply:
      const sideX = offsetIndex * VIEWER_CONFIG.sideOffset;

      return {
        position: [sideX, 1.6, VIEWER_CONFIG.sideZ],
        scale: VIEWER_CONFIG.adjacentPhotoScale,
        opacity: 0.6, // Slight transparency for side photos
      };
    }

    // Far away or hidden photos
    return {
      position: [offsetIndex * 2, 1.6, -5],
      scale: 0,
      opacity: 0,
    };
  };

  const target = getTargetState();

  const springs = useSpring({
    position: target.position,
    scale: [target.scale, target.scale, target.scale],
    opacity: target.opacity,
    config: { mass: 1, tension: 280, friction: 60 } // Smooth material entry
  });

  return springs;
}
