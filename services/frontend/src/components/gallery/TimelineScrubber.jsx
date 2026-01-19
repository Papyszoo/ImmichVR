import React, { useState, useMemo } from 'react';
import { Text } from '@react-three/drei';
import { useSpring, animated } from '@react-spring/three';

const AnimatedText = animated(Text);
const AnimatedGroup = animated.group;

function TimelineMarker({ label, position, onClick, isActive, showLabel }) {
  const [hovered, setHovered] = useState(false);
  
  const { scale, color } = useSpring({
    scale: hovered || isActive ? 1.5 : 1, // Pop effect
    color: hovered || isActive ? '#3B82F6' : '#888888',
    config: { tension: 300, friction: 20 }
  });

  return (
    <AnimatedGroup position={position} scale={scale}>
      {/* Hit Area (Larger than visible dot) */}
      <mesh 
        visible={true} 
        onClick={(e) => { e.stopPropagation(); onClick(label); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={(e) => { e.stopPropagation(); setHovered(false); }}
      >
        <planeGeometry args={[0.4, 0.05]} />
        <meshBasicMaterial transparent opacity={0.0} />
      </mesh>
      
      {/* Dot Marker (The "Tick") */}
      <mesh position={[-0.03, 0, 0]}>
        <sphereGeometry args={[0.008, 8, 8]} />
        <meshStandardMaterial color={showLabel ? "#ffffff" : "#666666"} />
      </mesh>

      {/* Label (Conditional) */}
      {showLabel && (
        <AnimatedText
          fontSize={0.08}
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

function TimelineScrubber({ onScrollToYear, groupPositions = {}, scrollY = 0, totalHeight = 1 }) {
  const visualHeight = 1.5; // Height of the scrubber in VR meters
  const visualWidth = 0.02;
  
  // Calculate marker positions based on real gallery content
  const markers = useMemo(() => {
    // console.log('[TimelineScrubber] Recalc markers. GroupPositions:', Object.keys(groupPositions).length, 'TotalHeight:', totalHeight);
    if (!groupPositions || Object.keys(groupPositions).length === 0) return [];
    
    // We only want to show Years to avoid clutter
    const yearsProcessed = new Set();
    const result = [];
    
    // Convert groupPositions to array and sort by Y (ascending/top-down)
    // groupPositions: { "November 2024": { y: 12.5, year: 2024 } }
    // Gallery Y starts at 0 at top and increases downwards.
    // Normalized position = y / totalHeight
    
    // Sort by Y (descending because Y gets larger as we go down, but visualY is negative)
    // Actually we want to process from Top (Y=0) to Bottom.
    // data.y increases as we go down.
    
    // Sort array by realY ascending (0 -> 100)
    const sortedGroup = Object.entries(groupPositions)
        .map(([label, data]) => ({ label, data }))
        .sort((a, b) => a.data.y - b.data.y);

    let lastLabelVisualY = 1000; // Start high
    const LABEL_THRESHOLD = 0.1; // Min distance between labels (meters)

    sortedGroup.forEach(({ label, data }) => {
      if (!yearsProcessed.has(data.year)) {
        yearsProcessed.add(data.year);
        
        const ratio = Math.min(1, Math.max(0, data.y / totalHeight));
        const visualY = -ratio * visualHeight;
        
        // Determine if we should show label
        let showLabel = false;
        // Always show first (top)
        if (result.length === 0) showLabel = true;
        // Show if distance from last label is large enough
        else if (Math.abs(visualY - lastLabelVisualY) > LABEL_THRESHOLD) {
            showLabel = true;
        }
        
        if (showLabel) {
            lastLabelVisualY = visualY;
        }

        result.push({
            label: data.year.toString(),
            visualY: visualY,
            realY: data.y,
            originalLabel: label,
            showLabel: showLabel
        });
      }
    });
    return result;
  }, [groupPositions, totalHeight]);

  // Thumb position
  const thumbRatio = Math.min(1, Math.max(0, scrollY / totalHeight));
  const thumbY = -thumbRatio * visualHeight;

  return (
    <group position={[2.8, 1.6, -1.0]} rotation={[0, -0.4, 0]}>
      {/* Rail */}
      <mesh position={[0, -visualHeight/2, 0]}>
        <boxGeometry args={[visualWidth, visualHeight, 0.01]} />
        <meshStandardMaterial color="#444" />
      </mesh>
      
      {/* Current Position Thumb */}
      <mesh position={[0, thumbY, 0.02]}>
         <sphereGeometry args={[0.03, 16, 16]} />
         <meshStandardMaterial color="#3B82F6" emissive="#3B82F6" emissiveIntensity={0.5} />
      </mesh>

      {/* Markers */}
      {markers.map((m, i) => {
        // Simple sparse labeling logic:
        // Always show first and last.
        // For others, only show if distance from previous LABEL is > 0.08 (approx text height)
        // We perform this check during render mapping, which is slightly inefficient but works for small lists (~50 years).
        // Better: pre-calc in useMemo. But for now let's just use a simple visually-spaced filter.
        
        return (
          <TimelineMarker
            key={m.label}
            label={m.label}
            position={[visualWidth/2 + 0.02, m.visualY, 0]}
            onClick={() => onScrollToYear(parseInt(m.label))}
            visualY={m.visualY}
            isActive={false} 
          />
        );
      })}
    </group>
  );
}

export default TimelineScrubber;
