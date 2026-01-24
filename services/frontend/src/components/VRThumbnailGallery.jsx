import React, { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { XR } from '@react-three/xr';
import { animated } from '@react-spring/three';
import { Root, Container, Text } from '@react-three/uikit';

// Extracted components
import xrStore from './xr/xrStore';
import PerformanceMonitor from './PerformanceMonitor';
import XRScrollController from './xr/XRScrollController';
import UIKitSettingsPanel from './vr-ui/uikit/UIKitSettingsPanel';
import Photo3DViewsPanel from './vr-ui/uikit/Photo3DViewsPanel';
import ViewerPositionPanel from './vr-ui/uikit/ViewerPositionPanel';

import CameraController from './gallery/CameraController';
import ThumbnailGrid from './gallery/ThumbnailGrid';
import TimelineScrubber from './gallery/TimelineScrubber';
import VRPhoto from './VRPhoto'; // Integrated for Viewer
import GaussianSplatViewer from './GaussianSplatViewer';
import styles from './gallery/galleryStyles';

import { usePhotoViewerAnimation } from '../hooks/usePhotoViewerAnimation';
import { usePhoto3DManager } from '../hooks/usePhoto3DManager';
import { use3DGenerationQueue } from '../hooks/use3DGenerationQueue';
import { generateAsset, generateDepthWithModel, getPhotoFiles, deletePhotoFile, getAIModels, getSettings, convertPlyToKsplat, getImmichBucket } from '../services/api';


/**
 * Wrapper component that uses the usePhoto3DManager hook
 * to provide viewOptions to the Photo3DViewsPanel presentation component
 */
function Photo3DViewsPanelWrapper({ photoId, photoFiles, availableModels, onGenerate, onRemove, onSelect, onConvert, activeModel, position, queue, processingItem }) {
  const { viewOptions } = usePhoto3DManager({
    generatedFiles: photoFiles,
    availableModels,
    photoId,
    // We could pass queue info to manager if we want it to handle status logic
    // But for now, let's play safe and handle it in the Panel or pass it through
  });
  
  return (
    <Photo3DViewsPanel
      viewOptions={viewOptions}
      activeModel={activeModel}
      onGenerate={onGenerate}
      onRemove={onRemove}
      onSelect={onSelect}
      onConvert={onConvert}
      position={position}
      queue={queue}
      processingItem={processingItem}
      photoId={photoId}
    />
  );
}




const BackToGridButton = ({ onClick }) => (
  <group position={[0, 0.45, -2.0]}>
    <Root pixelSize={0.005} anchorX="center" anchorY="center">
      <Container
        width={80}
        height={30}
        backgroundColor="#1F2937"
        hover={{ backgroundColor: '#3B82F6' }} // Primary blue on hover
        alignItems="center"
        justifyContent="center"
        borderRadius={15}
        onClick={onClick}
        cursor="pointer"
        borderWidth={2}
        borderColor="#374151"
      >
         <Text color="white" fontSize={14}>Back</Text>
      </Container>
    </Root>
  </group>
);


// Toggle Button for Filters (3D UI)
const FilterToggleButton = ({ isFiltered, onClick }) => (
  <group position={[-2.8, 2.0, -2.5]} rotation={[0, 0.3, 0]}>
    <Root pixelSize={0.005} anchorX="center" anchorY="center">
      <Container
        width={220}
        height={50}
        backgroundColor={isFiltered ? "#3B82F6" : "#1F2937"}
        backgroundOpacity={0.9}
        hover={{ backgroundColor: isFiltered ? "#2563EB" : "#374151" }}
        alignItems="center"
        justifyContent="center"
        borderRadius={25}
        onClick={onClick}
        cursor="pointer"
        borderWidth={isFiltered ? 0 : 2}
        borderColor="#4B5563"
        flexDirection="row"
      >
         <Text color="white" fontSize={20} fontWeight="bold">
            {isFiltered ? "Showing: 3D Content" : "Show 3D Only"}
         </Text>
      </Container>
    </Root>
  </group>
);


// Selection Panel (3D UI)
const SelectionPanel = ({ 
    selectionMode, 
    toggleSelectionMode, 
    selectedCount, 
    onGenerate, 
    onClear,
    queueStatus,
    settingsOpen
}) => {
   if (settingsOpen) return null;

   return (
    <group position={[-2.8, 1.4, -2.5]} rotation={[0, 0.3, 0]}>
      <Root pixelSize={0.005} anchorX="center" anchorY="center" flexDirection="column" gap={10}>
        {/* Toggle Mode Button */}
        <Container
          width={220}
          height={50}
          backgroundColor={selectionMode ? "#10B981" : "#374151"}
          backgroundOpacity={0.9}
          hover={{ backgroundColor: selectionMode ? "#059669" : "#4B5563" }}
          alignItems="center"
          justifyContent="center"
          borderRadius={25}
          onClick={toggleSelectionMode}
          cursor="pointer"
          borderWidth={2}
          borderColor="#4B5563"
        >
           <Text color="white" fontSize={18} fontWeight="bold">
              {selectionMode ? "Selection Mode ON" : "Select Photos"}
           </Text>
        </Container>

        {/* Actions (visible when mode is ON) */}
        {selectionMode && (
           <Container flexDirection="column" gap={8} width={220} padding={12} backgroundColor="rgba(0,0,0,0.8)" borderRadius={16}>
              <Text color="white" fontSize={16} textAlign="center">
                 Selected: {selectedCount}
              </Text>
              
              {selectedCount > 0 && (
                <>
                  <Container 
                      height={40} 
                      width="100%" 
                      backgroundColor="#3B82F6" 
                      hover={{ backgroundColor: "#2563EB" }}
                      borderRadius={8}
                      alignItems="center"
                      justifyContent="center"
                      onClick={onGenerate}
                      cursor="pointer"
                  >
                      <Text color="white" fontSize={16}>Queue SHARP</Text>
                  </Container>
                  
                  <Container 
                      height={30} 
                      width="100%" 
                      backgroundColor="#EF4444" 
                      hover={{ backgroundColor: "#DC2626" }}
                      borderRadius={8}
                      alignItems="center"
                      justifyContent="center"
                      onClick={onClear}
                      cursor="pointer"
                  >
                      <Text color="white" fontSize={14}>Clear Selection</Text>
                  </Container>
                </>
              )}
           </Container>
        )}
        
        {/* Queue Status */}
        {queueStatus && queueStatus.total > 0 && (
             <Container 
                width={220} 
                padding={12} 
                backgroundColor="#1F2937" 
                borderRadius={12}
                borderWidth={1}
                borderColor="#3B82F6"
                flexDirection="column"
                alignItems="center"
             >
                 <Text color="#3B82F6" fontSize={14} fontWeight="bold">Processing Queue</Text>
                 <Text color="white" fontSize={12} marginTop={4}>
                     Completed: {queueStatus.processed} / {queueStatus.total}
                 </Text>
                 {queueStatus.isProcessing && (
                     <Text color="#10B981" fontSize={12} marginTop={2}>Processing...</Text>
                 )}
             </Container>
        )}
      </Root>
    </group>
  );
};

function ViewerItem({ photo, index, selectedIndex, onSelect }) {
  const isSelected = index === selectedIndex;
  // Calculate relative offset (handling potential wrapping if we wanted circular, but list is linear for now)
  const offset = index - selectedIndex;
  
  // Optimization: Only render relevant items
  if (Math.abs(offset) > 5) return null;

  const { position, scale, opacity } = usePhotoViewerAnimation(isSelected, offset, true);

  // Note: opacity is animated, but VRPhoto needs to support transparent material updates.
  // We pass '1.0' effectively for now, relying on position/scale for entry/exit visual.
  // Ideally we'd use 'opacity.to(v => v)' but VRPhoto needs ref updates.

  return (
    <animated.group position={position} scale={scale}>
       <VRPhoto 
          photo={photo}
          onSelect={() => onSelect(photo)}
          opacity={1.0} 
          enableDepth={isSelected}
          depthScale={0.1} // Default for viewer
          loadFullQuality={isSelected}
       />
    </animated.group>
  );
}

// --- SCROLL ANCHORING COMPONENT (Must be inside Canvas) ---
function ScrollAnchoring({ virtualMap, visibleBuckets, scrollY, setScrollY, scrollAnchorRef }) {
  const prevVirtualMapRef = useRef(null);
  // Ref comes from parent now to resolve race conditions on Jump

  useLayoutEffect(() => {
     if (!prevVirtualMapRef.current || !scrollAnchorRef.current.id) {
         prevVirtualMapRef.current = virtualMap;
         return;
     }
     
     // Find where the anchor is now
     const anchorId = scrollAnchorRef.current.id;
     
     const oldItem = prevVirtualMapRef.current.items.find(i => i.id === anchorId);
     const newItem = virtualMap.items.find(i => i.id === anchorId);
     
     if (oldItem && newItem) {
         // The item moved from oldItem.y to newItem.y
         // The shift is (newItem.y - oldItem.y)
         // We must ADD this shift to scrollY to keep the camera relative to the item.
         const delta = newItem.y - oldItem.y;
         
         if (Math.abs(delta) > 0.001) {
            setScrollY(prev => prev + delta);
         }
     }
     
     prevVirtualMapRef.current = virtualMap;
  }, [virtualMap, setScrollY]);
  
  // Update Anchor *continuously* based on scroll
  useFrame(() => {
      // Find the item at top of screen (scrollY)
      // Optimization: use visibleBuckets[0]
      if (visibleBuckets.length > 0) {
          const top = visibleBuckets[0];
          scrollAnchorRef.current = {
              id: top.id,
              offset: scrollY - top.y // Distance into the bucket
          };
      }
  });

  return null;
}


/**
 * VRThumbnailGallery - Main VR gallery component with 3D depth thumbnails
 */
// Helper to estimate height of a bucket based on count
// Helper to estimate height of a bucket based on count
const estimateBucketHeight = (count, columns, rowHeight) => {
  const rows = Math.ceil(count / columns);
  
  // Heuristic: Assume roughly 1 date header for every 8 photos
  // A header is 0.4m + 0.2m gap = 0.6m
  const estimatedDateGroups = Math.max(1, Math.ceil(count / 8));
  const headerSpace = estimatedDateGroups * (0.4 + 0.2);
  
  return rows * rowHeight + headerSpace;
};

// Helper to calculate real height from photos including dates
const calculateRealHeight = (photos, settings) => {
    // Must match ThumbnailGrid layout logic exactly
    const rowHeight = settings.thumbnailHeight + settings.gap;
    const headerHeight = 0.4;
    const groupGap = 0.2;
    
    // 1. Group by date (Logical Grouping)
    const dateGroups = [];
    let currentGroup = null;
    
    if (!photos || !Array.isArray(photos) || photos.length === 0) return 0.6; // Return at least header height to allow render
    
    photos.forEach(photo => {
        const dateStr = photo.fileCreatedAt || photo.localDateTime || photo.createdAt;
        const date = dateStr ? new Date(dateStr) : new Date();
        const key = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
        
        if (!currentGroup || currentGroup.label !== key) {
            currentGroup = { label: key, photos: [] };
            dateGroups.push(currentGroup);
        }
        currentGroup.photos.push(photo);
    });
    
    // 2. Simulate Layout per Group
    let totalHeight = 0;
    
    dateGroups.forEach(group => {
        totalHeight += headerHeight;
        
        let currentRowWidth = 0;
        let rowCount = 1;
        
        group.photos.forEach(photo => {
            // Robust Aspect Ratio Calculation
            let aspectRatio = 1;
            let width = 0;
            let height = 0;
            
            // 1. Try generic ratio first (processed by Timeline API)
            if (photo.ratio) {
                aspectRatio = photo.ratio;
            } else {
                // 2. Try to find raw dimensions
                if (photo.exifInfo) {
                   if (photo.exifInfo.exifImageWidth && photo.exifInfo.exifImageHeight) {
                       width = photo.exifInfo.exifImageWidth;
                       height = photo.exifInfo.exifImageHeight;
                   } else if (photo.exifInfo.imageWidth && photo.exifInfo.imageHeight) {
                       width = photo.exifInfo.imageWidth;
                       height = photo.exifInfo.imageHeight;
                   }
                }
                
                if (!width && !height) {
                   if (photo.originalWidth && photo.originalHeight) {
                       width = photo.originalWidth;
                       height = photo.originalHeight;
                   } else if (photo.width && photo.height) { // Root fallback
                       width = photo.width;
                       height = photo.height;
                   }
                }
                
                // 3. Apply Orientation (Swap if 90 or 270 deg)
                // Orientation values: 5, 6, 7, 8 usually imply 90 degree rotation
                const orientation = photo.exifInfo?.orientation;
                if (orientation && (String(orientation) === '6' || String(orientation) === '8' || String(orientation).includes('90'))) {
                    // Swap
                    const temp = width;
                    width = height;
                    height = temp;
                }
                
                if (width && height) {
                    aspectRatio = width / height;
                } else {
                    aspectRatio = 1.0;
                }
            }
            aspectRatio = Math.max(0.5, Math.min(2.5, aspectRatio));
            
            const thumbWidth = settings.thumbnailHeight * aspectRatio + settings.gap;
            
            if (currentRowWidth + thumbWidth > settings.galleryWidth && currentRowWidth > 0) {
               rowCount++;
               currentRowWidth = thumbWidth;
            } else {
               currentRowWidth += thumbWidth;
            }
        });
        
        totalHeight += rowCount * rowHeight;
        totalHeight += groupGap;
    });

    return totalHeight;
};

// Skeleton Grid Component for loading state
// Skeleton Grid Component for loading state (InstancedMesh for performance)
const SkeletonGrid = ({ count, width, rowHeight, thumbnailHeight, gap }) => {
   const meshRef = useRef();
   const columns = Math.floor(width / (thumbnailHeight + gap)); 
   
   // Create a dummy object to compute matrices
   const dummy = useMemo(() => new THREE.Object3D(), []);

   useEffect(() => {
     if (!meshRef.current) return;
     
     // Cap count at reasonable limit (e.g. 10000 to cover large buckets)
     // InstancedMesh is performant enough for this.
     const safeCount = Math.min(count, 10000); 
     
     for (let i = 0; i < safeCount; i++) {
        const col = i % columns;
        const row = Math.floor(i / columns);
        
        // Centered alignment: (col - columns/2 + 0.5)
        const x = (col - columns / 2 + 0.5) * (thumbnailHeight + gap);
        const y = -row * rowHeight;
        
        dummy.position.set(x, y, 0);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
     }
     meshRef.current.instanceMatrix.needsUpdate = true;
     
     // FIX CULLING: Manually set bounding sphere to encompass the whole grid
     // Center is roughly at (0, -height/2, 0) with radius height/2
     if (meshRef.current.geometry) {
        const totalGridHeight = Math.ceil(safeCount / columns) * rowHeight;
        meshRef.current.geometry.boundingSphere = new THREE.Sphere(
            new THREE.Vector3(0, -totalGridHeight / 2, 0), 
            totalGridHeight // Generous radius
        );
     }
   }, [count, columns, rowHeight, thumbnailHeight, gap, dummy]);

   return (
     <instancedMesh ref={meshRef} args={[null, null, Math.min(count, 10000)]}>
       <planeGeometry args={[thumbnailHeight, thumbnailHeight]} />
       <meshBasicMaterial color="#333" transparent opacity={0.3} />
     </instancedMesh>
   );
};

function VRThumbnailGallery({ 
    timeline = [], 
    photoCache = {}, 
    setPhotoCache,
    onLoadBucket, 
    initialSelectedId = null, 
    onSelectPhoto, 
    onClose,
    // New Props for Filter/List Mode
    filterMode = 'all',
    onToggleFilter,
    photos: propPhotos = null, // Optional explicit list of photos (overrides timeline)
    onLoadMore,
    hasMore,
    loadingMore
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isInVR, setIsInVR] = useState(false);
  const [settings, setSettings] = useState({
    galleryWidth: 5.5,        // Width in meters
    thumbnailHeight: 0.5,   // Height in meters (50cm)
    wallCurvature: 0,       // 0 = flat, 1 = fully curved
    depthScale: 0.1,        // Depth displacement amount
    gap: 0.05,              // Gap between thumbnails
    wallDistance: 3,        // Distance from viewer
    enableGridDepth: false, // Toggle depth in grid view
    defaultDepthModel: 'small',  // Default model for auto-generate
    autoGenerateOnEnter: false,  // Auto-generate depth on photo enter
    disableAutoQuality: false,   // Disable adaptive quality drop
  });

  const [scrollY, setScrollY] = useState(0);
  const [depthCache, setDepthCache] = useState({});

  const scrollRef = useRef(null);
  const scrollAnchorRef = useRef({ id: null, offset: 0 }); // Shared anchor state
  
  // Viewer State
  const [selectedPhotoId, setSelectedPhotoId] = useState(initialSelectedId);
  
  // Photo 3D Views Panel state (keep existing)
  const [photoFiles, setPhotoFiles] = useState([]);
  const [downloadedModels, setDownloadedModels] = useState(['small']); 
  const [availableModels, setAvailableModels] = useState([]); 
  const [generatingModel, setGeneratingModel] = useState(null);
  const generatingRef = useRef(false);
  const [isConverting, setIsConverting] = useState(false);
  const selectingRef = useRef(false);
  const [activeDepthModel, setActiveDepthModel] = useState(null);
  const desiredViewTypeRef = useRef(null); // Track desired view type for navigation preservation
  const photoFilesPhotoIdRef = useRef(null); // Track which photo's files are in photoFiles state
  const [splatUrl, setSplatUrl] = useState(null);
  const [splatFormat, setSplatFormat] = useState('ply');
  
  const [qualityMode, setQualityMode] = useState('HIGH'); 
  const [dpr, setDpr] = useState(1.5);
  
  // PerformanceMonitor visibility (toggled with L3 button)
  const [showPerformanceMonitor, setShowPerformanceMonitor] = useState(false);
  
  // Viewer group position controls (affects entire viewer: photos, splats, UI panels)
  const [viewerGroupTransform, setViewerGroupTransform] = useState({
    positionX: 0,
    positionY: -0.6,
    positionZ: -0.4,
    scale: 1.5,
  });
  
  // Gaussian Splat transform (controlled by VR controller grips)
  const [splatTransform, setSplatTransform] = useState({
    positionX: 0,
    positionY: 1,
    positionZ: -2.5,
    scale: 2,
    rotation: new THREE.Quaternion(1, 0, 0, 0),
  });
  
  // Handle Transformation from XR Controllers (only affects GaussianSplatViewer)
  const handleSplatTransform = useCallback(({ positionDelta, rotationDelta, scaleFactor }) => {
     setSplatTransform(prev => {
        const next = { ...prev };
        
        // 1. Position
        if (positionDelta) {
            next.positionX += positionDelta.x;
            next.positionY += positionDelta.y;
            next.positionZ += positionDelta.z;
        }
        
        // 2. Scale
        if (scaleFactor) {
            next.scale = Math.max(0.1, Math.min(10.0, next.scale * scaleFactor));
        }
        
        // 3. Rotation
        if (rotationDelta) {
            const currentRot = prev.rotation.clone();
            const delta = rotationDelta; 
            
            // Apply delta: newRot = delta * oldRot
            // Note: Order matters. Pre-multiply for global/local. 
            // Usually we want to rotate the object relative to itself or world?
            // "Rotate scene" usually means rotating the object in place.
            currentRot.premultiply(delta);
            next.rotation = currentRot;
        }
        
        return next;
     });
  }, []);
  const [splatCount, setSplatCount] = useState(0);

  // Convert splatTransform quaternion to Euler angles for GaussianSplatViewer
  const splatRotationEuler = useMemo(() => {
    const euler = new THREE.Euler();
    euler.setFromQuaternion(splatTransform.rotation);
    return [euler.x, euler.y, euler.z];
  }, [splatTransform.rotation]);




  // Reset Splat to defaults (R3 Button)
  const handleResetSplat = useCallback(() => {
    setSplatTransform({
      positionX: 0,
      positionY: 1,
      positionZ: -2.5,
      scale: 9,
      rotation: new THREE.Quaternion(1, 0, 0, 0),
    });
  }, []);

  // Define completion handler for queue
  const handleQueueCompletion = useCallback((data) => {
      // If the completed item is the currently selected photo, refresh its files
      if (selectedPhotoId && data.id === selectedPhotoId && data.success) {
          console.log('[VRThumbnailGallery] Current photo processed, refreshing files...');
          getPhotoFiles(selectedPhotoId)
            .then(res => setPhotoFiles(res.files || []))
            .catch(err => console.warn('Failed to refresh files:', err));
      }
  }, [selectedPhotoId]);

  // Queue & Selection State
  // Pass the completion handler to the hook
  const { addToQueue, queueStatus, queue, processingItem } = use3DGenerationQueue(handleQueueCompletion);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState(new Set());

  // DERIVE PHOTOS - If propPhotos is provided (List Mode), use it. Otherwise derive from Timeline.
  const photos = useMemo(() => {
     if (propPhotos) return propPhotos;
     
     return timeline
        .map(bucket => photoCache[bucket.timeBucket] || [])
        .flat();
  }, [timeline, photoCache, propPhotos]);

  // Callback when lag is detected
  const handlePerformanceDrop = useCallback(() => {
    if (settings.disableAutoQuality) {
        console.log("Performance drop detected, but auto-optimization is disabled by user.");
        return;
    }
    if (qualityMode === 'HIGH') {
      console.log("Switching to LOW quality mode due to performance.");
      setQualityMode('LOW');
      setDpr(0.75); 
    }
  }, [qualityMode, settings.disableAutoQuality]);
  
  // Manual toggle for quality
  const handleToggleQuality = useCallback(() => {
      if (qualityMode === 'HIGH') {
          console.log("vRThumbnailGallery: Manually switching to LOW quality");
          setQualityMode('LOW');
          setDpr(0.75);
      } else {
          console.log("vRThumbnailGallery: Manually switching to HIGH quality");
          setQualityMode('HIGH');
          setDpr(1.5);
      }
  }, [qualityMode]);

  // Auto-generate depth when entering photo view
  useEffect(() => {
    if (!selectedPhotoId || !settings.autoGenerateOnEnter) return;
    
    // Check if depth already exists in cache or in photo metadata
    const photo = photos.find(p => p.id === selectedPhotoId);
    if (depthCache[selectedPhotoId] || photo?.depthUrl) return;
    
    console.log('Auto-generating asset for photo:', selectedPhotoId, 'with model:', settings.defaultDepthModel);
    
    const autoGenerate = async () => {
      try {
        const model = availableModels.find(m => m.key === settings.defaultDepthModel);
        if (!model) {
          console.error('Auto-generate: Model not found:', settings.defaultDepthModel);
          return;
        }
        
        const assetType = model.type || 'depth'; 
        console.log(`[VRThumbnailGallery] Auto-generating ${assetType} with model ${settings.defaultDepthModel}`);
        
        const blob = await generateAsset(selectedPhotoId, assetType, settings.defaultDepthModel);
        
        if (assetType === 'depth') {
          const url = URL.createObjectURL(blob);
          setDepthCache(prev => ({ ...prev, [selectedPhotoId]: url }));
          setActiveDepthModel(settings.defaultDepthModel);
        }
      } catch (err) {
        console.warn('Auto-generate asset failed:', err);
      }
    };
    
    autoGenerate();
  }, [selectedPhotoId, settings.autoGenerateOnEnter, settings.defaultDepthModel, photos, depthCache, availableModels]);
  
  // Fetch settings on mount
  useEffect(() => {
    getSettings()
      .then(data => {
        setSettings(prev => ({
          ...prev,
          defaultDepthModel: data.defaultDepthModel || prev.defaultDepthModel,
          autoGenerateOnEnter: data.autoGenerateOnEnter !== undefined ? data.autoGenerateOnEnter : prev.autoGenerateOnEnter,
          disableAutoQuality: data.disableAutoQuality !== undefined ? data.disableAutoQuality : prev.disableAutoQuality,
        }));
      })
      .catch(err => console.warn('Failed to fetch user settings:', err));
  }, []);

  // Fetch generated files when photo is selected
  useEffect(() => {
    if (!selectedPhotoId) {
      setPhotoFiles([]);
      photoFilesPhotoIdRef.current = null;
      return;
    }
    
    // Clear photoFiles immediately to prevent auto-select from using stale data
    setPhotoFiles([]);
    photoFilesPhotoIdRef.current = null; // Mark that photoFiles is now empty/invalid
    
    // Only reset active model if we're not preserving a view type
    // This prevents flashing the original photo when navigating between photos with the same view type
    if (!desiredViewTypeRef.current) {
      setActiveDepthModel(null);
      
      // Also clear splatUrl only when not preserving
      if (splatUrl) {
        URL.revokeObjectURL(splatUrl);
        setSplatUrl(null);
      }
    } else {
      console.log(`[Fetch] Preserving visual state for view type: ${desiredViewTypeRef.current}`);
      // Keep the current splatUrl/activeDepthModel visible until new one loads
      // This creates a smoother transition without flashing the original photo
    }
    
    // Track which photo we're fetching for to prevent race conditions
    const currentPhotoId = selectedPhotoId;
    console.log(`[Fetch] Starting fetch for photo ${currentPhotoId}`);
    
    getPhotoFiles(selectedPhotoId)
      .then(data => {
        // Only apply the results if we're still on the same photo
        if (currentPhotoId === selectedPhotoId) {
          console.log(`[Fetch] Received ${data.files?.length || 0} files for photo ${currentPhotoId}`);
          setPhotoFiles(data.files || []);
          photoFilesPhotoIdRef.current = currentPhotoId; // Mark which photo these files belong to
        } else {
          console.log(`[Fetch] Ignoring stale fetch result for photo ${currentPhotoId} (current: ${selectedPhotoId})`);
        }
      })
      .catch(err => console.warn('Failed to fetch photo files:', err));
  }, [selectedPhotoId]);
  
  // Fetch available models
  useEffect(() => {
    getAIModels()
      .then(data => {
        const aiModels = data.models || [];
        setAvailableModels(aiModels);
        
        const downloaded = aiModels
          .filter(m => m.is_downloaded)
          .map(m => m.key);
        
        if (downloaded.length > 0) {
            setDownloadedModels(downloaded);
        }
      })
      .catch(err => console.warn('Failed to fetch AI models:', err));
  }, [selectedPhotoId]);
  
  // Handle generate asset (Modified to use Queue)
  const handleGenerateDepth = useCallback(async (modelKey) => {
    console.log('[VRThumbnailGallery] handleGenerateDepth called with:', modelKey);
    if (!selectedPhotoId) {
        console.warn('[VRThumbnailGallery] No selected photo ID');
        return;
    }
    
    // Add to Queue instead of immediate generation
    // We need to look up the type from availableModels
    console.log('[VRThumbnailGallery] Available models:', availableModels);
    const model = availableModels.find(m => m.key === modelKey);
    
    if (!model && modelKey !== 'ksplat') {
         console.warn('[VRThumbnailGallery] Model not found and not ksplat:', modelKey);
         return;
    }
    
    const type = (modelKey === 'ksplat') ? 'splat' : (model ? (model.type || 'depth') : 'depth');
    console.log('[VRThumbnailGallery] Determined type:', type);

    addToQueue({
        id: selectedPhotoId,
        modelKey,
        type
    });
  }, [selectedPhotoId, availableModels, addToQueue]);
    

  
  // Handle remove file
  const handleRemoveFile = useCallback(async (modelKey) => {
    if (!selectedPhotoId) return;
    
    let file;
    if (modelKey === 'ksplat') {
      file = photoFiles.find(f => f.modelKey === 'sharp' && f.format === 'ksplat');
    } else if (modelKey === 'sharp') {
      file = photoFiles.find(f => f.modelKey === 'sharp' && f.format === 'ply');
    } else {
      file = photoFiles.find(f => f.modelKey === modelKey);
    }
    if (!file) return;
    
    try {
      await deletePhotoFile(selectedPhotoId, file.id);
      const data = await getPhotoFiles(selectedPhotoId);
      setPhotoFiles(data.files || []);
      
      if (activeDepthModel === modelKey) {
        setActiveDepthModel(null);
        
        // Clear splat URL if it was active
        if (splatUrl) {
            URL.revokeObjectURL(splatUrl);
            setSplatUrl(null);
        }

        setDepthCache(prev => {
          const next = { ...prev };
          delete next[selectedPhotoId];
          return next;
        });
      }
    } catch (err) {
      console.error('Failed to delete file:', err);
    }
  }, [selectedPhotoId, photoFiles, activeDepthModel]);
  
  // Handle select depth/splat
  const handleSelectDepth = useCallback(async (modelKey) => {
    console.log(`[handleSelectDepth] Called with modelKey: ${modelKey}, selectedPhotoId: ${selectedPhotoId}, photoFiles count: ${photoFiles.length}`);
    
    if (!selectedPhotoId || selectingRef.current) return;
    
    selectingRef.current = true;
    
    try {
      if (modelKey === 'normal') {
        console.log('[handleSelectDepth] Switching to normal view');
        if (splatUrl) {
          URL.revokeObjectURL(splatUrl);
          setSplatUrl(null);
        }
        
        setActiveDepthModel('normal');
        
        // Remove from depth cache to force 2D fallback
        setDepthCache(prev => {
          const newCache = { ...prev };
          delete newCache[selectedPhotoId];
          return newCache;
        });
        return;
      }

      let file;
      if (modelKey === 'ksplat') {
        file = photoFiles.find(f => f.modelKey === 'sharp' && f.format === 'ksplat');
      } else if (modelKey === 'sharp') {
        file = photoFiles.find(f => f.modelKey === 'sharp' && f.format === 'ply');
      } else {
        file = photoFiles.find(f => f.modelKey === modelKey);
      }
      
      console.log(`[handleSelectDepth] Found file:`, file);
      
      if (!file) {
        // Compatibility: if no file but modelKey is 'small'/'medium'/'large', it might be legacy depth
        // But we rely on file list now.
        console.log(`[handleSelectDepth] No file found for modelKey: ${modelKey}`);
        return;
      }
      
      if (file.type === 'depth') {
        if (splatUrl) {
          URL.revokeObjectURL(splatUrl);
          setSplatUrl(null);
        }
        
        try {
          const downloadUrl = `/api/assets/${selectedPhotoId}/files/${file.id}/download`;
          console.log(`[handleSelectDepth] Downloading depth file from: ${downloadUrl}`);
          const response = await fetch(downloadUrl);
          if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            setDepthCache(prev => ({ ...prev, [selectedPhotoId]: url }));
            setActiveDepthModel(modelKey);
            console.log(`[handleSelectDepth] Depth loaded successfully for photo ${selectedPhotoId}`);
          }
        } catch (err) { console.error('[handleSelectDepth] Depth load error:', err); }
      } else if (file.type === 'splat') {
        try {
          const downloadUrl = `/api/assets/${selectedPhotoId}/files/${file.id}/download`;
          console.log(`[handleSelectDepth] Downloading splat file from: ${downloadUrl}`);
          const response = await fetch(downloadUrl);
          if (response.ok) {
            const blob = await response.blob();
            if (blob.size === 0) {
              console.log('[handleSelectDepth] Splat file is empty');
              return;
            }
            
            if (splatUrl) URL.revokeObjectURL(splatUrl);
            const url = URL.createObjectURL(blob);
            console.log(`[handleSelectDepth] Splat loaded successfully for photo ${selectedPhotoId}, format: ${file.format}, size: ${blob.size} bytes`);
            setSplatUrl(url);
            setSplatFormat(file.format || 'ply');
            setActiveDepthModel(modelKey);
            
            setDepthCache(prev => {
              const newCache = { ...prev };
              delete newCache[selectedPhotoId];
              return newCache;
            });
          }
        } catch (err) { console.error('[handleSelectDepth] Splat load error:', err); }
      }
    } finally {
      selectingRef.current = false;
    }
  }, [selectedPhotoId, photoFiles, splatUrl]);
  
  // Auto-select preserved view type after photo files are loaded
  useEffect(() => {
    if (!selectedPhotoId || !desiredViewTypeRef.current) return;
    
    // If photoFiles is still empty (loading), wait for it to populate
    if (photoFiles.length === 0) return;
    
    // CRITICAL: Validate that photoFiles belong to the current photo
    if (photoFilesPhotoIdRef.current !== selectedPhotoId) {
      console.log(`[Auto-select] Skipping stale photoFiles (belong to ${photoFilesPhotoIdRef.current}, current: ${selectedPhotoId})`);
      return;
    }
    
    const desiredView = desiredViewTypeRef.current;
    console.log(`[Auto-select] Checking view ${desiredView} for photo ${selectedPhotoId}, found ${photoFiles.length} files`);
    console.log(`[Auto-select] Files belong to photo: ${photoFilesPhotoIdRef.current}`);
    
    desiredViewTypeRef.current = null; // Clear after processing
    
    // Check if the desired view is available for this photo
    let file;
    if (desiredView === 'ksplat') {
      file = photoFiles.find(f => f.modelKey === 'sharp' && f.format === 'ksplat');
    } else if (desiredView === 'sharp') {
      file = photoFiles.find(f => f.modelKey === 'sharp' && f.format === 'ply');
    } else if (desiredView !== 'normal') {
      file = photoFiles.find(f => f.modelKey === desiredView);
    }
    
    if (file || desiredView === 'normal') {
      // View is available, select it
      console.log(`[Auto-select] Preserving view type: ${desiredView} for photo ${selectedPhotoId}, file ID: ${file?.id}`);
      handleSelectDepth(desiredView);
    } else {
      // View not available, default to normal photo
      console.log(`[Auto-select] View type ${desiredView} not available for photo ${selectedPhotoId}, defaulting to normal photo`);
      handleSelectDepth('normal');
    }
  }, [photoFiles, handleSelectDepth]); // Removed selectedPhotoId to prevent running with stale files
  
  // Handle KSPLAT conversion
  const handleConvert = useCallback(async (modelKey) => {
    if (modelKey === 'ksplat' && !isConverting) {
      setIsConverting(true);
      try {
        await convertPlyToKsplat(selectedPhotoId);
        const data = await getPhotoFiles(selectedPhotoId);
        setPhotoFiles(data.files || []);
      } catch (err) {
        console.error('Conversion failed:', err);
      } finally {
        setIsConverting(false);
      }
    }
  }, [selectedPhotoId, isConverting]);

  
  // --- METADATA PRE-FETCH & SCROLL ANCHORING ---
  
  // Queue metadata fetch for all buckets to ensure accurate timeline
  // --- METADATA PRE-FETCH & SCROLL ANCHORING ---
  // Global prefetch removed to fix performance issues with large libraries.
  // We now rely solely on the visibility-based loading (virtualization) below.

  // Handle Load More (Infinite Scroll) for List Mode


  // Scroll Anchoring: Keep the current view stable when heights change



  // 1. Calculate Virtual Map (Positions of all buckets)
  const virtualMap = useMemo(() => {
    // Case A: List Mode (propPhotos) -> Single bucket or just flat mapping
    if (propPhotos) {
        // Create a synthetic map for the flat list
        console.log('[VRThumbnailGallery] Calculating virtual map for filtered results:', propPhotos.length);
        const map = [];
        
        const height = calculateRealHeight(propPhotos, settings);
        console.log('[VRThumbnailGallery] Calculated height for filtered results:', height);
        
        map.push({
            id: 'filtered-results',
            y: 0,
            height: height,
            count: propPhotos.length,
            isLoaded: true
        });
        
        return { items: map, totalHeight: height };
    }
  
    // Case B: Timeline Mode (Normal)
    const map = [];
    let currentY = 0;
    
    // Compute dynamic average for FALLBACK
    let totalKnownCnt = 0;
    let totalKnownH = 0;
    timeline.forEach(bucket => {
        if (photoCache[bucket.timeBucket]) {
             const h = calculateRealHeight(photoCache[bucket.timeBucket], settings);
             totalKnownH += h;
             totalKnownCnt += bucket.count;
        }
    });
    
    let avgHeightPerPhoto = 0.05; // Fallback
    if (totalKnownCnt > 0) avgHeightPerPhoto = totalKnownH / totalKnownCnt;
    else {
        const rowHeight = settings.thumbnailHeight + settings.gap;
        const avgWidth = settings.thumbnailHeight * 1.33 + settings.gap; // 4:3
        const columns = Math.floor(settings.galleryWidth / avgWidth);
        const estRowH = rowHeight + (0.6/8); // header overhead
        avgHeightPerPhoto = estRowH / columns;
    }

    timeline.forEach(bucket => {
        const isLoaded = !!photoCache[bucket.timeBucket];
        let height;
        
        if (isLoaded) {
            height = calculateRealHeight(photoCache[bucket.timeBucket], settings);
        } else {
            height = bucket.count * avgHeightPerPhoto;
        }
        
        map.push({
            id: bucket.timeBucket,
            y: currentY,
            height: height,
            count: bucket.count,
            isLoaded
        });
        
        currentY += height + 0.2;
    });
    
    return { items: map, totalHeight: currentY };
  }, [timeline, photoCache, settings, propPhotos]);

  // Derive Year Positions from Virtual Map for Scrubber
  const groupPositions = useMemo(() => {
    const groups = {};
    if (!virtualMap.items) return groups;
    
    virtualMap.items.forEach(item => {
        // Robust Year extraction
        const yearStr = item.id.substring(0, 4); 
        const year = parseInt(yearStr, 10);
        
        if (isNaN(year)) return;
        
        if (!groups[year]) {
             groups[year] = { id: year, y: item.y, count: 0, label: year.toString() };
        }
        
        // Update Y to the current item's Y
        // Since we iterate Newest->Oldest (Dec->Jan), the last update will be the position of January.
        groups[year].y = item.y; 
        groups[year].count += item.count;
    });
    
    return groups;
  }, [virtualMap]);

  const displayYears = useMemo(() => {
    const years = new Set();
    timeline.forEach(b => {
      const y = b.timeBucket.substring(0, 4);
      if (!isNaN(y)) years.add(parseInt(y));
    });
    return Array.from(years).sort((a,b) => b - a);
  }, [timeline]);

  // 2. Determine Visible Buckets
  const visibleBuckets = useMemo(() => {
      const viewportHeight = 8; // Visible area height in meters
      const buffer = 4; // Lookahead
      
      // We assume scrollY is positive (0 to totalHeight)
      // Content Group is at [0, scrollY, 0]
      // Buckets are at [0, -bucket.y, 0] relative to Group
      // WorldY of bucket = scrollY - bucket.y
      // We want WorldY to be around 1.6 (camera). Range [-2, 6] e.g.
      
      return virtualMap.items.filter(item => {
          const itemTop = -item.y + scrollY; // World Top
          const itemBottom = -item.y - item.height + scrollY; // World Bottom
          
          // Check intersection with viewport [-2, 10] (approx)
          // Simple visibility check
          return (itemTop > -10 && itemBottom < 20);
      });
  }, [virtualMap, scrollY]);

  // 3. Trigger Loads for Visible Ghosts
  useEffect(() => {
      visibleBuckets.forEach(bucket => {
          if (!bucket.isLoaded && onLoadBucket) {
             onLoadBucket(bucket.id);
          }
      });
  }, [visibleBuckets, onLoadBucket]);
  

  
  // --- END VIRTUALIZATION ---
  
  const totalHeight = virtualMap.totalHeight;

  // Handle Load More (Infinite Scroll) for List Mode
  useEffect(() => {
      // If we are in list mode (propPhotos provided) and scrolled near bottom
      if (!propPhotos || !onLoadMore || !hasMore || loadingMore) return;
      
      // Simple check: if scrollY is near totalHeight
      const threshold = 6.0; // meters (increased from 2.0 to ensure early trigger)
      if (totalHeight - scrollY < threshold) {
          onLoadMore();
      }
  }, [scrollY, totalHeight, propPhotos, onLoadMore, hasMore, loadingMore]);

  // Scroll to a specific year
  const handleScrollToYear = useCallback((year) => {
    // Find first bucket of this year
    const item = virtualMap.items.find(i => i.id.startsWith(year.toString()));
    if (item) {
       const targetY = item.y + 1.6;
       setScrollY(targetY); 
       // FORCE ANCHOR to prevent jump if layout recalculates
       scrollAnchorRef.current = { id: item.id, offset: 1.6 };
    } else {
        // Fallback or load logic if not in timeline (shouldn't implement if timeline is full)
        console.warn(`Year ${year} not in timeline`);
    }
  }, [virtualMap]);



  // Handle Photo Selection (Enter Viewer OR Toggle Selection)
  const handleSelect = useCallback((photo, position, rotation) => {
    if (selectionMode) {
        setSelectedPhotos(prev => {
            const next = new Set(prev);
            if (next.has(photo.id)) next.delete(photo.id);
            else next.add(photo.id);
            return next;
        });
    } else {
        // If not already selected, select it (Enter Viewer)
        if (selectedPhotoId !== photo.id) {
           setSelectedPhotoId(photo.id);
        }
    }
  }, [selectedPhotoId, selectionMode]);

  // Handle Multi-Selection Generation
  const handleGenerateSelected = useCallback(() => {
      const items = Array.from(selectedPhotos).map(id => ({
          id,
          modelKey: 'sharp', // Default to SHARP as requested
          type: 'splat'
      }));
      addToQueue(items);
      setSelectedPhotos(new Set());
      setSelectionMode(false);
  }, [selectedPhotos, addToQueue]);

  // Handle Close Viewer
  const handleCloseViewer = useCallback(() => {
    setSelectedPhotoId(null);
  }, []);

  // Handle Viewer Navigation (Next/Prev)
  const handleNext = useCallback(() => {
    if (!selectedPhotoId) return;
    const index = photos.findIndex(p => p.id === selectedPhotoId);
    if (index < photos.length - 1) {
       // Preserve the active view type when navigating
       if (activeDepthModel) {
         desiredViewTypeRef.current = activeDepthModel;
       }
       
       const nextPhotoId = photos[index + 1].id;
       setSelectedPhotoId(nextPhotoId);
    }
  }, [selectedPhotoId, photos, activeDepthModel]);

  const handlePrev = useCallback(() => {
    if (!selectedPhotoId) return;
    const index = photos.findIndex(p => p.id === selectedPhotoId);
    if (index > 0) {
       // Preserve the active view type when navigating
       if (activeDepthModel) {
         desiredViewTypeRef.current = activeDepthModel;
       }
       
       const prevPhotoId = photos[index - 1].id;
       setSelectedPhotoId(prevPhotoId);
    }
  }, [selectedPhotoId, photos, activeDepthModel]);


  // Scroll interactions (only valid when viewer is closed)
  useEffect(() => {
    if (selectedPhotoId) return; // Disable scroll in viewer mode

    const handleWheel = (e) => {
      // If settings are open, allow default behavior (scrolling the modal) 
      // and do NOT scroll the gallery.
      if (settingsOpen) return;

      e.preventDefault();
      const scrollSpeed = 0.005; // Slightly faster
      setScrollY(prev => {
        const newY = prev + e.deltaY * scrollSpeed;
        return Math.max(0, Math.min(totalHeight, newY));
      });
    };

    const container = scrollRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
    }

    return () => {
      if (container) {
        container.removeEventListener('wheel', handleWheel);
      }
    };
  }, [totalHeight, selectedPhotoId, settingsOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Disable keyboard navigation if settings are open
      if (settingsOpen) return;

      if (selectedPhotoId) {
        // Viewer navigation
        if (e.key === 'ArrowLeft') handlePrev();
        if (e.key === 'ArrowRight') handleNext();
        if (e.key === 'Escape' || e.key === 'Backspace') handleCloseViewer();
        return;
      }

      const scrollSpeed = 0.5;
      if (e.key === 'ArrowUp' || e.key === 'w') {
        setScrollY(prev => Math.max(0, prev - scrollSpeed));
      } else if (e.key === 'ArrowDown' || e.key === 's') {
        setScrollY(prev => Math.min(totalHeight, prev + scrollSpeed));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [totalHeight, selectedPhotoId, handleNext, handlePrev, handleCloseViewer, settingsOpen]);

  // Cleanup depth URLs
  useEffect(() => {
    return () => {
      Object.values(depthCache).forEach(url => {
        if (url && url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, []);
  
  // Derived selected index
  const selectedIndex = useMemo(() => {
    if (!selectedPhotoId) return -1;
    return photos.findIndex(p => p.id === selectedPhotoId);
  }, [photos, selectedPhotoId]);

  // --- TEST BRIDGE ---
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__VR_VIEWER_INTERNALS = {
        state: {
          selectedPhotoId,
          photoFiles,
          generatingModel,
          depthCache,
          settings,
          viewerGroupTransform,
          splatTransform,
          photos 
        },
        actions: {
            generateAsset: handleGenerateDepth,
            removeAsset: handleRemoveFile,
            selectPhoto: (id) => setSelectedPhotoId(id),
            setSettings: setSettings,
            setViewerGroupTransform: setViewerGroupTransform,
            setSplatTransform: setSplatTransform
        }
      };
    }
  }, [selectedPhotoId, photoFiles, generatingModel, depthCache, settings, photos, handleGenerateDepth, handleRemoveFile]);

  return (
    <div ref={scrollRef} style={styles.container}>
      {/* UI Overlay Buttons */}
      <button 
        style={styles.settingsButton}
        onClick={() => setSettingsOpen(true)}
      >
        ⚙️ Settings
      </button>

      {/* Back Button Logic */}
      {selectedPhotoId ? (
        <button style={styles.backButton} onClick={handleCloseViewer}>
           ← Back to Grid
        </button>
      ) : null}

      {/* VR Button */}
      <button style={styles.vrButton} onClick={() => xrStore.enterVR()}>
        🥽 Enter VR
      </button>
      
      

      {/* Scroll indicator (Removed legacy DOM overlay) */}

      {/* Hint */}
      <div style={styles.scrollHint}>
        {selectedPhotoId 
          ? 'Use thumbstick or arrow keys to navigate' 
          : 'Scroll or use ↑↓ to navigate'
        }
      </div>

      {/* 3D Canvas */}
      <Canvas 
        style={styles.canvas}
        dpr={dpr}
        camera={{ position: [0, 1.6, 0], fov: 70, near: 0.1, far: 1000 }}
        gl={{ antialias: qualityMode === 'HIGH' }}
      >
        <XR store={xrStore}>
          <color attach="background" args={['#000000']} />
          <ambientLight intensity={1.0} />
          <directionalLight position={[0, 5, 5]} intensity={0.3} />

          <PerformanceMonitor 
            enabled={showPerformanceMonitor}
            position={[-2, 2.5, -2]} 
            onPerformanceDrop={handlePerformanceDrop}
            qualityMode={qualityMode}
            onToggleQuality={handleToggleQuality}
          />

          <CameraController scrollY={selectedPhotoId ? 0 : scrollY} />
          <XRScrollController 
             setScrollY={setScrollY} 
             totalHeight={totalHeight} 
             setSettingsOpen={setSettingsOpen}
             isViewerMode={!!selectedPhotoId}
             paused={settingsOpen}
             onNextPhoto={handleNext}
             onPrevPhoto={handlePrev}
             onCloseViewer={handleCloseViewer}
             onTransform={handleSplatTransform}
             onTogglePerformanceMonitor={() => setShowPerformanceMonitor(prev => !prev)}
             onResetSplat={handleResetSplat}
          />
          
          <ScrollAnchoring 
             virtualMap={virtualMap}
             visibleBuckets={visibleBuckets}
             scrollY={scrollY}
             setScrollY={setScrollY}
             scrollAnchorRef={scrollAnchorRef}
          />

          {/* UIKit Settings Panel (renders in 3D space) */}
          <UIKitSettingsPanel
            isOpen={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            settings={settings}
            onSettingsChange={setSettings}
          />
          
          
          {/* Timeline Scrubber (VR Native) */}
          {!selectedPhotoId && (
            <>
                <TimelineScrubber 
                  onScrollToYear={handleScrollToYear}
                  onScroll={(y) => setScrollY(Math.max(0, Math.min(y, totalHeight)))}
                  years={displayYears} // Note: This prop is not actually used in TimelineScrubber, it uses groupPositions
                  groupPositions={groupPositions}
                  scrollY={scrollY}
                  totalHeight={totalHeight}
                />
                
                {/* Processed 3D Filter Toggle (Left Side) */}
                <FilterToggleButton 
                    isFiltered={filterMode === 'splats'}
                    onClick={onToggleFilter}
                />

                {/* Selection Panel (Left Side, above Filter) */}
                <SelectionPanel 
                    selectionMode={selectionMode}
                    toggleSelectionMode={() => setSelectionMode(prev => !prev)}
                    selectedCount={selectedPhotos.size}
                    onGenerate={handleGenerateSelected}
                    onClear={() => { setSelectedPhotos(new Set()); setSelectionMode(false); }}
                    queueStatus={queueStatus}
                    settingsOpen={settingsOpen}
                />
            </>
          )}
          
          {/* Render Virtualized Buckets if NO photo selected */}
          {!selectedPhotoId && (
            <group position={[0, scrollY, 0]}>
                {visibleBuckets.map(bucket => (
                    <group key={bucket.id} position={[0, -bucket.y, 0]}>
                        {bucket.isLoaded ? (
                            <ThumbnailGrid
                                photos={bucket.id === 'filtered-results' ? propPhotos : (photoCache[bucket.id] || [])}
                                onSelectPhoto={handleSelect}
                                settings={settings}
                                setSettings={setSettings}
                                settingsOpen={settingsOpen}
                                setSettingsOpen={setSettingsOpen}
                                scrollY={scrollY - bucket.y}
                                disableVerticalShift={true}
                                depthCache={depthCache}
                                selectionMode={selectionMode}
                                selectedPhotos={selectedPhotos}
                            />
                        ) : (
                            <SkeletonGrid 
                                count={bucket.count} 
                                width={settings.galleryWidth}
                                rowHeight={settings.thumbnailHeight + settings.gap}
                                thumbnailHeight={settings.thumbnailHeight}
                                gap={settings.gap}
                            />
                        )}
                        {/* Debug Text for bucket? */}
                         {/* <Text position={[-3, 0.5, 0]} fontSize={0.2} color="white">{bucket.id}</Text> */}
                    </group>
                ))}
            </group>
          )}

          {/* Render Viewer if photo SELECTED */}
          {selectedPhotoId && (
             <group 
                position={[viewerGroupTransform.positionX, viewerGroupTransform.positionY, viewerGroupTransform.positionZ]}
                scale={[viewerGroupTransform.scale, viewerGroupTransform.scale, viewerGroupTransform.scale]}
             >
                {/* Render current and adjacent photos - HIDE when splat is active */}
                {!(splatUrl && (splatFormat === 'ksplat' || splatFormat === 'splat' || splatFormat === 'ply' || splatFormat === 'spz')) && photos.map((photo, index) => {
                   // Only render if close to selected index (optimization)
                   if (Math.abs(index - selectedIndex) > 5) return null;
                   
                   // Important: ViewerItem needs absolute Position? 
                   // Or is it relative to viewer center?
                   // ViewerItem currently animates based on index offset.
                   // As long as we pass valid index/selectedIndex, it should work.
                   
                   return (
                      <ViewerItem 
                        key={photo.id}
                        photo={photo}
                        index={index}
                        selectedIndex={selectedIndex}
                        onSelect={handleSelect} 
                      />
                   );
                })}

                {/* VR Back Button */}
                <BackToGridButton onClick={handleCloseViewer} />
                
                {/* Gaussian Splat Viewer */}
                {splatUrl && (splatFormat === 'ksplat' || splatFormat === 'splat' || splatFormat === 'ply' || splatFormat === 'spz') && (
                  <GaussianSplatViewer
                    splatUrl={splatUrl}
                    quality={qualityMode}
                    fileType={splatFormat}  
                    testMode={false}  
                    position={[splatTransform.positionX, splatTransform.positionY, splatTransform.positionZ]}
                    rotation={splatRotationEuler}
                    scale={splatTransform.scale}
                    onLoad={(mesh, count) => setSplatCount(count || 0)}
                    onError={(err) => console.error('[Splat] Viewer error:', err)}
                  />
                )}
                
                <ViewerPositionPanel
                  transform={viewerGroupTransform}
                  onTransformChange={setViewerGroupTransform}
                  splatCount={splatCount}
                  position={[-2.5, 1.6, -settings.wallDistance]}
                />
                
                <Photo3DViewsPanelWrapper
                  photoId={selectedPhotoId}
                  photoFiles={photoFiles}
                  availableModels={availableModels}
                  activeModel={activeDepthModel}
                  onGenerate={handleGenerateDepth}
                  onRemove={handleRemoveFile}
                  onSelect={handleSelectDepth}
                  onConvert={handleConvert}
                  position={[2.5, 1.6, -settings.wallDistance]}
                  queue={queue}
                  processingItem={processingItem}
                />
             </group>
          )}

        </XR>
      </Canvas>
    </div>
  );
}

export default VRThumbnailGallery;
