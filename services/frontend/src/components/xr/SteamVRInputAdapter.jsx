
import React from 'react';
import { DefaultXRInputSourceRayPointer } from '@react-three/xr';

/**
 * A custom input adapter for SteamVR to handle cases where controllers 
 * are detected as "hands" but we want controller-like behavior (Ray Pointer).
 * 
 * Bypasses strict type checks in DefaultXRController.
 */
export function SteamVRInputAdapter() {
  return (
    <>
      {/* Visual representation: A simple stick to indicate controller position */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -0.05]}>
        <cylinderGeometry args={[0.005, 0.005, 0.1, 16]} />
        <meshStandardMaterial color="#888888" />
      </mesh>

      {/* 
        Enable Ray Pointer for interaction (clicking/scrolling).
        DefaultXRInputSourceRayPointer listens for 'select' events (Trigger).
      */}
      <DefaultXRInputSourceRayPointer 
        minDistance={0.1}
        rayModel={{
            color: 'white',
            opacity: 0.8
        }}
      />
    </>
  );
}
