import React, { useState, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';

/**
 * PerformanceMonitor - Displays FPS and performance metrics in VR
 * Detects sustained low FPS and triggers optimization callbacks.
 * Also provides manual quality toggle.
 */
function PerformanceMonitor({ 
  enabled = false, 
  position = [-3, 3, -2],
  onPerformanceDrop, // Callback when sustained low FPS is detected
  qualityMode = 'HIGH', // Current quality mode (HIGH/LOW)
  onToggleQuality // Callback to manual toggle quality
}) {
  const [fps, setFps] = useState(0);
  const [avgFps, setAvgFps] = useState(0);
  const [hovered, setHovered] = useState(false);
  
  const timeAccumulator = useRef(0);
  const framesInInterval = useRef(0);
  const fpsHistory = useRef([]);
  const lowFpsCounter = useRef(0); 
  const criticalFpsCounter = useRef(0);
  const hasTriggeredRef = useRef(false); 
  
  useFrame((state, delta) => {
    if (!enabled) return;
    
    // Accumulate time and frames
    timeAccumulator.current += delta;
    framesInInterval.current += 1;
    
    // Update every 500ms (independent of framerate)
    if (timeAccumulator.current >= 0.5) {
      const currentFps = Math.round(framesInInterval.current / timeAccumulator.current);
      
      setFps(currentFps);
      
      // Update history (keep last 10 samples = 5 seconds)
      fpsHistory.current.push(currentFps);
      if (fpsHistory.current.length > 10) fpsHistory.current.shift();
      
      // Calculate average
      const average = fpsHistory.current.reduce((a, b) => a + b, 0) / fpsHistory.current.length;
      setAvgFps(Math.round(average));

      // --- DETECT LAG ---
      // Strategy: Fast trigger for critical drops, slower trigger for mild drops
      
      // 1. Critical Drop (< 25 FPS) - Trigger effectively immediately (after 1s confirmed)
      if (currentFps < 25) {
        criticalFpsCounter.current += 1;
      } else {
        criticalFpsCounter.current = 0;
      }

      // 2. Sustained Low (< 45 FPS) - Trigger after ~2.5s
      const isLow = fpsHistory.current.length >= 5 && average < 45;
      if (isLow) {
        lowFpsCounter.current += 1;
      } else {
        lowFpsCounter.current = 0;
      }

      // Trigger Logic
      if (!hasTriggeredRef.current && onPerformanceDrop) {
        // Critical: 2 consecutive checks (1.0 second) below 25 FPS
        if (criticalFpsCounter.current >= 2) {
            console.warn(`PerformanceMonitor: CRITICAL FPS drop detected (${currentFps}). Triggering optimization immediately.`);
            onPerformanceDrop();
            hasTriggeredRef.current = true;
        }
        // Sustained: 5 consecutive checks (2.5 seconds) below 45 FPS average
        else if (lowFpsCounter.current >= 5) {
            console.warn(`PerformanceMonitor: Sustained low FPS detected (Avg ${Math.round(average)}). Triggering optimization.`);
            onPerformanceDrop(); 
            hasTriggeredRef.current = true; 
        }
      }
      
      // Reset accumulators
      timeAccumulator.current = 0;
      framesInInterval.current = 0;
    }
  });
  
  if (!enabled) return null;
  
  // Color code based on performance
  const getColor = (val) => {
    if (val >= 72) return '#00ff00'; // Green
    if (val >= 60) return '#88ff00'; // Yellow-green
    if (val >= 45) return '#ffaa00'; // Orange
    return '#ff0000'; // Red
  };
  
  return (
    <group position={position}>
      {/* FPS Display */}
      <Text
        position={[0, 0, 0]}
        fontSize={0.15}
        color={getColor(fps)}
        anchorX="left"
        anchorY="middle"
      >
        FPS: {fps}
      </Text>
      
      {/* Average FPS */}
      <Text
        position={[0, -0.2, 0]}
        fontSize={0.12}
        color="#aaaaaa"
        anchorX="left"
        anchorY="middle"
      >
        Avg: {avgFps}
      </Text>
      
      {/* Performance Status */}
      <Text
        position={[0, -0.4, 0]}
        fontSize={0.1}
        color={getColor(avgFps)}
        anchorX="left"
        anchorY="middle"
      >
        {criticalFpsCounter.current > 0 ? 'CRITICAL' : avgFps >= 72 ? 'Excellent' : avgFps >= 60 ? 'Good' : avgFps >= 45 ? 'OK' : 'Low'}
      </Text>

      {/* Manual Quality Toggle Button */}
      {onToggleQuality && (
        <group 
            position={[0.6, -0.3, 0]} 
            onClick={(e) => { e.stopPropagation(); onToggleQuality(); }}
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
        >
            <mesh>
                <planeGeometry args={[0.4, 0.2]} />
                <meshBasicMaterial color={hovered ? '#444' : '#222'} />
            </mesh>
            <Text
                position={[0, 0, 0.01]}
                fontSize={0.1}
                color={qualityMode === 'HIGH' ? '#00ff00' : '#ffaa00'}
                anchorX="center"
                anchorY="middle"
            >
                {qualityMode === 'HIGH' ? 'HQ' : 'LQ'}
            </Text>
            <Text
                position={[0, 0.15, 0]}
                fontSize={0.06}
                color="#aaaaaa"
                anchorX="center"
                anchorY="bottom"
            >
                Quality
            </Text>
        </group>
      )}
    </group>
  );
}

export default PerformanceMonitor;
