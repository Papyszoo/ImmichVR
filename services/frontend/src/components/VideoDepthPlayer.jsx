import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture, Text } from '@react-three/drei';
import * as THREE from 'three';
import JSZip from 'jszip';

/**
 * ControlButton - A clickable 3D button
 */
function ControlButton({ position, color, label, onClick }) {
  const [hovered, setHovered] = useState(false);
  
  return (
    <group 
      position={position}
      onClick={onClick}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <mesh>
        <boxGeometry args={[0.5, 0.3, 0.1]} />
        <meshStandardMaterial color={hovered ? '#ffffff' : color} />
      </mesh>
      <Text
        position={[0, 0, 0.06]}
        fontSize={0.12}
        color={hovered ? '#000000' : 'white'}
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
    </group>
  );
}

/**
 * FrameMesh - Renders a single frame with depth displacement
 */
function FrameMesh({ frameUrl, zoomLevel, rotationY, meshRef }) {
  const texture = useTexture(frameUrl);
  
  const geometry = useMemo(() => {
    return new THREE.PlaneGeometry(3, 3, 64, 64);
  }, []);

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      scale={[zoomLevel, zoomLevel, zoomLevel]}
      rotation={[0, rotationY, 0]}
    >
      <meshStandardMaterial
        map={texture}
        displacementMap={texture}
        displacementScale={0.5}
        displacementBias={-0.25}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/**
 * VideoDepthPlayer - Displays video frames with depth maps in VR
 * Extracts frames from ZIP file and plays them sequentially
 */
function VideoDepthPlayer({ media, onClose, onNext, onPrevious }) {
  const [frames, setFrames] = useState([]);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [rotationY, setRotationY] = useState(0);
  const [fps, setFps] = useState(1);
  const meshRef = useRef();
  const playIntervalRef = useRef(null);

  // Fetch depth blob if not provided
  const fetchDepthBlob = async (mediaItem) => {
    try {
      const response = await fetch(`/api/media/${mediaItem.id}/depth`);
      if (response.ok) {
        return await response.blob();
      }
    } catch (error) {
      console.error('Error fetching depth blob:', error);
    }
    return null;
  };

  // Extract frames from ZIP file
  useEffect(() => {
    const extractFrames = async () => {
      setLoading(true);
      try {
        const depthBlob = media.depthBlob || await fetchDepthBlob(media);
        
        if (!depthBlob) {
          console.error('No depth map blob available');
          setLoading(false);
          return;
        }

        const zip = new JSZip();
        const zipContents = await zip.loadAsync(depthBlob);
        
        const frameFiles = Object.keys(zipContents.files)
          .filter(name => name.endsWith('.png'))
          .sort();

        const framePromises = frameFiles.map(async (fileName) => {
          const fileData = await zipContents.files[fileName].async('blob');
          const url = URL.createObjectURL(fileData);
          return { fileName, url, blob: fileData };
        });

        const extractedFrames = await Promise.all(framePromises);
        setFrames(extractedFrames);
        
        if (media.metadata && media.metadata.fps) {
          setFps(media.metadata.fps);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error extracting frames:', error);
        setLoading(false);
      }
    };

    extractFrames();

    return () => {
      frames.forEach(frame => {
        if (frame.url) {
          URL.revokeObjectURL(frame.url);
        }
      });
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, [media]);

  // Handle playback
  useEffect(() => {
    if (isPlaying && frames.length > 0) {
      const interval = 1000 / fps;
      playIntervalRef.current = setInterval(() => {
        setCurrentFrameIndex(prev => (prev + 1) % frames.length);
      }, interval);
    } else {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
    }

    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, [isPlaying, frames, fps]);

  // Animate rotation
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = rotationY + Math.sin(state.clock.elapsedTime * 0.2) * 0.02;
    }
  });

  const handlePlayPause = () => setIsPlaying(prev => !prev);
  const handlePreviousFrame = () => {
    setIsPlaying(false);
    setCurrentFrameIndex(prev => (prev - 1 + frames.length) % frames.length);
  };
  const handleNextFrame = () => {
    setIsPlaying(false);
    setCurrentFrameIndex(prev => (prev + 1) % frames.length);
  };
  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.2, 2.0));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.2, 0.5));
  const handleRotateLeft = () => setRotationY(prev => prev + 0.3);
  const handleRotateRight = () => setRotationY(prev => prev - 0.3);

  if (loading) {
    return (
      <group position={[0, 1.5, -2]}>
        <Text position={[0, 0, 0]} fontSize={0.2} color="white" anchorX="center">
          Loading video frames...
        </Text>
      </group>
    );
  }

  if (frames.length === 0) {
    return (
      <group position={[0, 1.5, -2]}>
        <Text position={[0, 0, 0]} fontSize={0.2} color="white" anchorX="center">
          No frames available
        </Text>
        <ControlButton position={[0, -0.5, 0]} color="#ff3333" label="Close" onClick={onClose} />
      </group>
    );
  }

  const currentFrame = frames[currentFrameIndex];

  return (
    <group position={[0, 1.5, -3]}>
      {/* Main 3D Depth View */}
      {currentFrame && currentFrame.url && (
        <Suspense fallback={
          <Text position={[0, 0, 0]} fontSize={0.2} color="white" anchorX="center">
            Loading frame...
          </Text>
        }>
          <FrameMesh 
            frameUrl={currentFrame.url} 
            zoomLevel={zoomLevel} 
            rotationY={rotationY}
            meshRef={meshRef}
          />
        </Suspense>
      )}

      {/* Playback Controls */}
      <group position={[-2.5, -2.2, 0]}>
        <ControlButton position={[0, 0, 0]} color="#4CAF50" label={isPlaying ? 'Pause' : 'Play'} onClick={handlePlayPause} />
        <ControlButton position={[0.8, 0, 0]} color="#4CAF50" label="<" onClick={handlePreviousFrame} />
        <ControlButton position={[1.5, 0, 0]} color="#4CAF50" label=">" onClick={handleNextFrame} />
      </group>

      {/* Zoom Controls */}
      <group position={[0, -2.2, 0]}>
        <ControlButton position={[0, 0, 0]} color="#2196F3" label="+" onClick={handleZoomIn} />
        <ControlButton position={[0.6, 0, 0]} color="#2196F3" label="-" onClick={handleZoomOut} />
      </group>

      {/* Rotation Controls */}
      <group position={[1.2, -2.2, 0]}>
        <ControlButton position={[0, 0, 0]} color="#9C27B0" label="Rot L" onClick={handleRotateLeft} />
        <ControlButton position={[0.6, 0, 0]} color="#9C27B0" label="Rot R" onClick={handleRotateRight} />
      </group>

      {/* Close Button */}
      <ControlButton position={[2.5, 2, 0]} color="#ff3333" label="Close" onClick={onClose} />

      {/* Media Info */}
      <Text
        position={[0, 2.2, 0]}
        fontSize={0.15}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {media.originalFilename || media.original_filename || 'Video'}
      </Text>

      {/* Frame Info */}
      <Text
        position={[0, -2.7, 0]}
        fontSize={0.12}
        color="#aaaaaa"
        anchorX="center"
        anchorY="middle"
      >
        Frame {currentFrameIndex + 1} / {frames.length} | Zoom: {(zoomLevel * 100).toFixed(0)}%
      </Text>
    </group>
  );
}

export default VideoDepthPlayer;
