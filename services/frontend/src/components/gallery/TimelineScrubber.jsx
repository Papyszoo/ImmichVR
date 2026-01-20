import React, { useState, useMemo } from 'react';
import { Text } from '@react-three/drei';
import { useSpring, animated } from '@react-spring/three';

const AnimatedText = animated(Text);
const AnimatedGroup = animated.group;

function TimelineMarker({ label, position, isActive, showLabel }) {
  const [hovered, setHovered] = useState(false);
  
  const { scale, color } = useSpring({
    scale: hovered || isActive ? 1.5 : 1, 
    color: hovered || isActive ? '#3B82F6' : '#888888',
    config: { tension: 300, friction: 20 }
  });

  return (
    <AnimatedGroup position={position} scale={scale}>
       {/* Dot Marker (Subtle tick) */}
      <mesh position={[-0.03, 0, 0]}>
        <sphereGeometry args={[0.008, 8, 8]} />
        <meshStandardMaterial color={showLabel ? "#ffffff" : "#555"} emissive={showLabel ? "#555" : "#000"} />
      </mesh>

      {/* Label (Conditional) */}
      {showLabel && (
        <AnimatedText
          fontSize={0.12} // Larger font
          color={color}
          anchorX="left"
          anchorY="middle"
          position={[0.02, 0, 0]}
        >
          {label}
        </AnimatedText>
      )}
    </AnimatedGroup>
  );
}

function TimelineScrubber({ onScrollToYear, onScroll, groupPositions = {}, scrollY = 0, totalHeight = 1 }) {
  const [dragging, setDragging] = useState(false);
  const visualHeight = 3; // Taller rail
  const visualWidth = 0.06;
  
  // Calculate marker positions
  const markers = useMemo(() => {
    if (!groupPositions || Object.keys(groupPositions).length === 0) return [];
    
    // Sort by realY ascending (0 -> Total)
    const sortedGroup = Object.entries(groupPositions)
        .map(([label, data]) => ({ label, data }))
        .sort((a, b) => a.data.y - b.data.y); // Ascending Y order (Top to Bottom)

    let lastLabelVisualY = 1000;
    const LABEL_THRESHOLD = 0.08; 

    return sortedGroup.map(({ label, data }, index) => {
        const ratio = Math.min(1, Math.max(0, data.y / totalHeight));
        const visualY = (0.5 - ratio) * visualHeight;
        
        let showLabel = false;
        
        // Always show first and last
        if (index === 0 || index === sortedGroup.length - 1) {
             showLabel = true;
        } else if (Math.abs(visualY - lastLabelVisualY) > LABEL_THRESHOLD) {
             showLabel = true;
        }
        
        if (showLabel) {
            lastLabelVisualY = visualY;
        }

        return {
            label: data.label,
            visualY: visualY,
            realY: data.y,
            showLabel
        };
    });
  }, [groupPositions, totalHeight]);

  // Handle continuous scrubbing
  const handlePointerMove = (e) => {
    if (!dragging || !onScroll) return;
    e.stopPropagation();
    
    // Calculate Y relative to center of mesh, but mesh is at 0,0,0 relative to group
    // e.uv gives normalized coordinates [0,1]
    if (e.uv) {
        // UV.y is 0 at bottom, 1 at top for Plane/Box usually?
        // Let's assume standard UV mapping: 0=bottom, 1=top.
        // Screen Y (content) 0 is top.
        // So contentRatio = 1 - uv.y
        const ratio = 1 - e.uv.y;
        const targetY = ratio * totalHeight;
        onScroll(targetY);
    }
  };

  const handlePointerDown = (e) => {
    e.stopPropagation();
    e.target.setPointerCapture(e.pointerId);
    setDragging(true);
    if (e.uv && onScroll) {
        const ratio = 1 - e.uv.y;
        onScroll(ratio * totalHeight);
    }
  };

  const handlePointerUp = (e) => {
     e.stopPropagation();
     e.target.releasePointerCapture(e.pointerId);
     setDragging(false);
  };

  // Thumb position
  const thumbRatio = Math.min(1, Math.max(0, scrollY / totalHeight));
  const thumbY = (0.5 - thumbRatio) * visualHeight;
  
  // Debug scroll/height
  // console.log(`[Scrubber] Scroll: ${scrollY.toFixed(2)} / ${totalHeight.toFixed(2)} (Ratio: ${thumbRatio.toFixed(3)}) -> ThumbY: ${thumbY.toFixed(3)}`);


  return (
    <group position={[2.8, 1.5, -3]} rotation={[0, -0.4, 0]}>
      {/* Interaction Rail (Invisible Hit Box + Visible Bar) */}
      <mesh 
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp} // Safety
      >
        {/* Wider hit area for ease of use */}
        <boxGeometry args={[0.2, visualHeight, 0.05]} /> 
        <meshBasicMaterial visible={false} /> {/* Invisible hit target */}
      </mesh>
      
      {/* Visible Rail Line */}
      <mesh position={[0, 0, -0.01]}>
        <boxGeometry args={[0.005, visualHeight, 0.005]} />
        <meshStandardMaterial color="#666" />
      </mesh>
      
      {/* Current Position Thumb */}
      <mesh position={[0, thumbY, 0.01]} pointerEvents="none">
         <sphereGeometry args={[0.02, 16, 16]} />
         <meshStandardMaterial color="#3B82F6" emissive="#3B82F6" emissiveIntensity={0.8} />
      </mesh>

      {/* Markers */}
      {markers.map((m, i) => (
         <TimelineMarker
            key={i}
            label={m.label}
            position={[0.02, m.visualY, 0]} // Close to rail, single column
            showLabel={m.showLabel}
            isActive={false}
         />
      ))}
    </group>
  );
}

export default TimelineScrubber;
