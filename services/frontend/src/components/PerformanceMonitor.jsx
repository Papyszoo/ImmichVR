import React, { useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';

/**
 * PerformanceMonitor - Displays FPS and performance metrics in VR
 */
function PerformanceMonitor({ enabled = false, position = [-3, 3, -2] }) {
  const [fps, setFps] = useState(0);
  const [avgFps, setAvgFps] = useState(0);
  const [frameCount, setFrameCount] = useState(0);
  const [fpsHistory, setFpsHistory] = useState([]);
  
  useFrame((state, delta) => {
    if (!enabled) return;
    
    // Calculate current FPS
    const currentFps = 1 / delta;
    
    // Update frame count
    setFrameCount(prev => prev + 1);
    
    // Update FPS every 30 frames
    if (frameCount % 30 === 0) {
      setFps(Math.round(currentFps));
      
      // Update history for averaging (keep last 60 samples)
      setFpsHistory(prev => {
        const newHistory = [...prev, currentFps].slice(-60);
        const average = newHistory.reduce((a, b) => a + b, 0) / newHistory.length;
        setAvgFps(Math.round(average));
        return newHistory;
      });
    }
  });
  
  if (!enabled) return null;
  
  // Color code based on performance
  const getColor = (fps) => {
    if (fps >= 72) return '#00ff00'; // Green - excellent (VR standard)
    if (fps >= 60) return '#88ff00'; // Yellow-green - good
    if (fps >= 45) return '#ffaa00'; // Orange - acceptable
    return '#ff0000'; // Red - poor
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
        {avgFps >= 72 ? 'Excellent' : avgFps >= 60 ? 'Good' : avgFps >= 45 ? 'OK' : 'Poor'}
      </Text>
    </group>
  );
}

export default PerformanceMonitor;
