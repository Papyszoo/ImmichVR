import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLoader, useFrame } from '@react-three/fiber';
import { TextureLoader } from 'three';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { Interactive, useXR } from '@react-three/xr';
import JSZip from 'jszip';
import { getMediaDepth } from '../services/api';

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
  const [fps, setFps] = useState(1); // Default 1 fps
  const meshRef = useRef();
  const playIntervalRef = useRef(null);
  const framesRef = useRef([]); // Store frames for cleanup
  const { isPresenting } = useXR();

  // Extract frames from ZIP file
  useEffect(() => {
    const extractFrames = async () => {
      setLoading(true);
      try {
        // Get the depth map ZIP file
        const depthBlob = media.depthBlob || await fetchDepthBlob(media);
        
        if (!depthBlob) {
          console.error('No depth map blob available');
          setLoading(false);
          return;
        }

        // Load ZIP file
        const zip = new JSZip();
        const zipContents = await zip.loadAsync(depthBlob);
        
        // Extract all PNG files
        const frameFiles = Object.keys(zipContents.files)
          .filter(name => name.endsWith('.png'))
          .sort(); // Sort to maintain frame order

        // Extract frame data
        const framePromises = frameFiles.map(async (fileName) => {
          const fileData = await zipContents.files[fileName].async('blob');
          const url = URL.createObjectURL(fileData);
          return { fileName, url, blob: fileData };
        });

        const extractedFrames = await Promise.all(framePromises);
        setFrames(extractedFrames);
        framesRef.current = extractedFrames; // Store in ref for cleanup
        
        // Get FPS from metadata if available
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

    // Cleanup
    return () => {
      // Clean up frame URLs from ref
      framesRef.current.forEach(frame => {
        if (frame.url) {
          URL.revokeObjectURL(frame.url);
        }
      });
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, [media]);

  // Fetch depth blob if not provided
  const fetchDepthBlob = async (mediaItem) => {
    try {
      return await getMediaDepth(mediaItem.id);
    } catch (error) {
      console.error('Error fetching depth blob:', error);
      return null;
    }
  };

  // Handle playback
  useEffect(() => {
    if (isPlaying && frames.length > 0) {
      const interval = 1000 / fps; // Convert fps to milliseconds
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

  // Load current frame texture
  const currentFrame = frames[currentFrameIndex];
  const frameTexture = currentFrame && currentFrame.url 
    ? useLoader(TextureLoader, currentFrame.url) 
    : null;

  // Create displacement-mapped geometry
  const geometry = useMemo(() => {
    return new THREE.PlaneGeometry(3, 3, 64, 64);
  }, []);

  // Animate rotation
  useFrame((state, delta) => {
    if (meshRef.current && isPresenting) {
      meshRef.current.rotation.y = rotationY + Math.sin(state.clock.elapsedTime * 0.2) * 0.02;
    }
  });

  const handlePlayPause = () => {
    setIsPlaying(prev => !prev);
  };

  const handlePreviousFrame = () => {
    setIsPlaying(false);
    setCurrentFrameIndex(prev => (prev - 1 + frames.length) % frames.length);
  };

  const handleNextFrame = () => {
    setIsPlaying(false);
    setCurrentFrameIndex(prev => (prev + 1) % frames.length);
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.2, 2.0));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.2, 0.5));
  };

  const handleRotateLeft = () => {
    setRotationY(prev => prev + 0.3);
  };

  const handleRotateRight = () => {
    setRotationY(prev => prev - 0.3);
  };

  if (loading) {
    return (
      <group position={[0, 1.5, -2]}>
        <Text
          position={[0, 0, 0]}
          fontSize={0.2}
          color="white"
          anchorX="center"
        >
          Loading video frames...
        </Text>
      </group>
    );
  }

  if (frames.length === 0) {
    return (
      <group position={[0, 1.5, -2]}>
        <Text
          position={[0, 0, 0]}
          fontSize={0.2}
          color="white"
          anchorX="center"
        >
          No frames available
        </Text>
        <group position={[0, -0.5, 0]}>
          <Interactive onSelect={onClose}>
            <group>
              <mesh>
                <boxGeometry args={[0.5, 0.3, 0.1]} />
                <meshStandardMaterial color="#ff3333" />
              </mesh>
              <Text
                position={[0, 0, 0.06]}
                fontSize={0.15}
                color="white"
                anchorX="center"
                anchorY="middle"
              >
                Close
              </Text>
            </group>
          </Interactive>
        </group>
      </group>
    );
  }

  return (
    <group position={[0, 1.5, -3]}>
      {/* Main 3D Depth View */}
      {frameTexture && (
        <mesh
          ref={meshRef}
          geometry={geometry}
          scale={[zoomLevel, zoomLevel, zoomLevel]}
          rotation={[0, rotationY, 0]}
        >
          <meshStandardMaterial
            map={frameTexture}
            displacementMap={frameTexture}
            displacementScale={0.5}
            displacementBias={-0.25}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Playback Controls - Bottom Left */}
      <group position={[-2.5, -2.2, 0]}>
        <Interactive onSelect={handlePlayPause}>
          <group>
            <mesh>
              <boxGeometry args={[0.5, 0.3, 0.1]} />
              <meshStandardMaterial color="#4CAF50" />
            </mesh>
            <Text
              position={[0, 0, 0.06]}
              fontSize={0.15}
              color="white"
              anchorX="center"
              anchorY="middle"
            >
              {isPlaying ? 'Pause' : 'Play'}
            </Text>
          </group>
        </Interactive>
      </group>

      <group position={[-1.7, -2.2, 0]}>
        <Interactive onSelect={handlePreviousFrame}>
          <group>
            <mesh>
              <boxGeometry args={[0.4, 0.3, 0.1]} />
              <meshStandardMaterial color="#4CAF50" />
            </mesh>
            <Text
              position={[0, 0, 0.06]}
              fontSize={0.15}
              color="white"
              anchorX="center"
              anchorY="middle"
            >
              ◄
            </Text>
          </group>
        </Interactive>
      </group>

      <group position={[-1.0, -2.2, 0]}>
        <Interactive onSelect={handleNextFrame}>
          <group>
            <mesh>
              <boxGeometry args={[0.4, 0.3, 0.1]} />
              <meshStandardMaterial color="#4CAF50" />
            </mesh>
            <Text
              position={[0, 0, 0.06]}
              fontSize={0.15}
              color="white"
              anchorX="center"
              anchorY="middle"
            >
              ►
            </Text>
          </group>
        </Interactive>
      </group>

      {/* Zoom Controls */}
      <group position={[0, -2.2, 0]}>
        <Interactive onSelect={handleZoomIn}>
          <group>
            <mesh>
              <boxGeometry args={[0.4, 0.3, 0.1]} />
              <meshStandardMaterial color="#2196F3" />
            </mesh>
            <Text
              position={[0, 0, 0.06]}
              fontSize={0.15}
              color="white"
              anchorX="center"
              anchorY="middle"
            >
              +
            </Text>
          </group>
        </Interactive>
      </group>

      <group position={[0.6, -2.2, 0]}>
        <Interactive onSelect={handleZoomOut}>
          <group>
            <mesh>
              <boxGeometry args={[0.4, 0.3, 0.1]} />
              <meshStandardMaterial color="#2196F3" />
            </mesh>
            <Text
              position={[0, 0, 0.06]}
              fontSize={0.15}
              color="white"
              anchorX="center"
              anchorY="middle"
            >
              -
            </Text>
          </group>
        </Interactive>
      </group>

      {/* Rotation Controls */}
      <group position={[1.2, -2.2, 0]}>
        <Interactive onSelect={handleRotateLeft}>
          <group>
            <mesh>
              <boxGeometry args={[0.4, 0.3, 0.1]} />
              <meshStandardMaterial color="#9C27B0" />
            </mesh>
            <Text
              position={[0, 0, 0.06]}
              fontSize={0.15}
              color="white"
              anchorX="center"
              anchorY="middle"
            >
              ↶
            </Text>
          </group>
        </Interactive>
      </group>

      <group position={[1.8, -2.2, 0]}>
        <Interactive onSelect={handleRotateRight}>
          <group>
            <mesh>
              <boxGeometry args={[0.4, 0.3, 0.1]} />
              <meshStandardMaterial color="#9C27B0" />
            </mesh>
            <Text
              position={[0, 0, 0.06]}
              fontSize={0.15}
              color="white"
              anchorX="center"
              anchorY="middle"
            >
              ↷
            </Text>
          </group>
        </Interactive>
      </group>

      {/* Close Button - Top Right */}
      <group position={[2.5, 2, 0]}>
        <Interactive onSelect={onClose}>
          <group>
            <mesh>
              <boxGeometry args={[0.5, 0.3, 0.1]} />
              <meshStandardMaterial color="#ff3333" />
            </mesh>
            <Text
              position={[0, 0, 0.06]}
              fontSize={0.15}
              color="white"
              anchorX="center"
              anchorY="middle"
            >
              Close
            </Text>
          </group>
        </Interactive>
      </group>

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
