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
import { generateAsset, generateDepthWithModel, getPhotoFiles, deletePhotoFile, getAIModels, getSettings, convertPlyToKsplat, getImmichBucket } from '../services/api';


/**
 * Wrapper component that uses the usePhoto3DManager hook
 * to provide viewOptions to the Photo3DViewsPanel presentation component
 */
function Photo3DViewsPanelWrapper({ photoId, photoFiles, availableModels, onGenerate, onRemove, onSelect, onConvert, activeModel, position }) {
  const { viewOptions } = usePhoto3DManager({
    generatedFiles: photoFiles,
    availableModels,
    photoId,
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
            let aspectRatio = 1;
            if (photo.ratio) {
               aspectRatio = photo.ratio;
            } else if (photo.exifInfo && photo.exifInfo.exifImageWidth && photo.exifInfo.exifImageHeight) {
               aspectRatio = photo.exifInfo.exifImageWidth / photo.exifInfo.exifImageHeight;
            } else {
                // Fallback for missing EXIF (common in processed generic assets)
                aspectRatio = 1.0; 
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
  const [splatUrl, setSplatUrl] = useState(null);
  const [splatFormat, setSplatFormat] = useState('ply');
  
  const [qualityMode, setQualityMode] = useState('HIGH'); 
  const [dpr, setDpr] = useState(1.5);
  
  // Viewer position controls
  const [viewerTransform, setViewerTransform] = useState({
    positionX: 0,
    positionY: 1.8,
    positionZ: -0.4,
    scale: 0.5,
    rotationY: 0,
  });
  const [splatCount, setSplatCount] = useState(0);

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
      return;
    }
    
    setActiveDepthModel(null);
    if (splatUrl) {
      URL.revokeObjectURL(splatUrl);
      setSplatUrl(null);
    }
    
    getPhotoFiles(selectedPhotoId)
      .then(data => setPhotoFiles(data.files || []))
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
  
  // Handle generate asset
  const handleGenerateDepth = useCallback(async (modelKey) => {
    if (!selectedPhotoId || generatingRef.current) return;
    
    const existingFile = photoFiles.find(f => f.modelKey === modelKey);
    if (existingFile) return;
    
    generatingRef.current = true;
    setGeneratingModel(modelKey);
    
    try {
      if (modelKey === 'ksplat') {
        const response = await fetch(`/api/assets/${selectedPhotoId}/convert`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: 'ply', to: 'ksplat' })
        });
        if (!response.ok) throw new Error(`Conversion failed`);
        const data = await getPhotoFiles(selectedPhotoId);
        setPhotoFiles(data.files || []);
        return;
      }
      
      const model = availableModels.find(m => m.key === modelKey);
      if (!model) return;
      
      const assetType = model.type || 'depth';
      const blob = await generateAsset(selectedPhotoId, assetType, modelKey);
      
      if (assetType === 'depth') {
        const url = URL.createObjectURL(blob);
        setDepthCache(prev => ({ ...prev, [selectedPhotoId]: url }));
        setActiveDepthModel(modelKey);
      }
      
      const data = await getPhotoFiles(selectedPhotoId);
      setPhotoFiles(data.files || []);
    } catch (err) {
      console.error('Failed to generate asset:', err);
    } finally {
      generatingRef.current = false;
      setGeneratingModel(null);
    }
  }, [selectedPhotoId, availableModels, photoFiles]);
  
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
    if (!selectedPhotoId || selectingRef.current) return;
    
    selectingRef.current = true;
    
    try {
      if (modelKey === 'normal') {
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
      
      if (!file) {
        // Compatibility: if no file but modelKey is 'small'/'medium'/'large', it might be legacy depth
        // But we rely on file list now.
        return;
      }
      
      if (file.type === 'depth') {
        if (splatUrl) {
          URL.revokeObjectURL(splatUrl);
          setSplatUrl(null);
        }
        
        try {
          const response = await fetch(`/api/assets/${selectedPhotoId}/files/${file.id}/download`);
          if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            setDepthCache(prev => ({ ...prev, [selectedPhotoId]: url }));
            setActiveDepthModel(modelKey);
          }
        } catch (err) { console.error(err); }
      } else if (file.type === 'splat') {
        try {
          const response = await fetch(`/api/assets/${selectedPhotoId}/files/${file.id}/download`);
          if (response.ok) {
            const blob = await response.blob();
            if (blob.size === 0) return;
            
            if (splatUrl) URL.revokeObjectURL(splatUrl);
            const url = URL.createObjectURL(blob);
            setSplatUrl(url);
            setSplatFormat(file.format || 'ply');
            setActiveDepthModel(modelKey);
            
            setDepthCache(prev => {
              const newCache = { ...prev };
              delete newCache[selectedPhotoId];
              return newCache;
            });
          }
        } catch (err) { console.error(err); }
      }
    } finally {
      selectingRef.current = false;
    }
  }, [selectedPhotoId, photoFiles, splatUrl]);
  
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
      const threshold = 2.0; // meters
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



  // Handle Photo Selection (Enter Viewer)
  const handleSelect = useCallback((photo, position, rotation) => {
    // If not already selected, select it
    if (selectedPhotoId !== photo.id) {
       setSelectedPhotoId(photo.id);
    }
  }, [selectedPhotoId]);

  // Handle Close Viewer
  const handleCloseViewer = useCallback(() => {
    setSelectedPhotoId(null);
  }, []);

  // Handle Viewer Navigation (Next/Prev)
  const handleNext = useCallback(() => {
    if (!selectedPhotoId) return;
    const index = photos.findIndex(p => p.id === selectedPhotoId);
    if (index < photos.length - 1) {
       setSelectedPhotoId(photos[index + 1].id);
    }
  }, [selectedPhotoId, photos]);

  const handlePrev = useCallback(() => {
    if (!selectedPhotoId) return;
    const index = photos.findIndex(p => p.id === selectedPhotoId);
    if (index > 0) {
       setSelectedPhotoId(photos[index - 1].id);
    }
  }, [selectedPhotoId, photos]);


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
          viewerTransform,
          photos 
        },
        actions: {
            generateAsset: handleGenerateDepth,
            removeAsset: handleRemoveFile,
            selectPhoto: (id) => setSelectedPhotoId(id),
            setSettings: setSettings,
            setViewerTransform: setViewerTransform
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
        camera={{ position: [0, 1.6, 0], fov: 70, near: 0.1, far: 100 }}
        gl={{ antialias: qualityMode === 'HIGH' }}
      >
        <XR store={xrStore}>
          <color attach="background" args={['#000000']} />
          <ambientLight intensity={1.0} />
          <directionalLight position={[0, 5, 5]} intensity={0.3} />

          <PerformanceMonitor 
            enabled={true}
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
             <group position={[0, 0, 0]}>
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
                    position={[viewerTransform.positionX, viewerTransform.positionY, viewerTransform.positionZ]}
                    rotation={[Math.PI, viewerTransform.rotationY * (Math.PI / 180), 0]}
                    scale={viewerTransform.scale}
                    onLoad={(mesh, count) => setSplatCount(count || 0)}
                    onError={(err) => console.error('[Splat] Viewer error:', err)}
                  />
                )}
                
                <ViewerPositionPanel
                  transform={viewerTransform}
                  onTransformChange={setViewerTransform}
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
                />
             </group>
          )}

        </XR>
      </Canvas>
    </div>
  );
}

export default VRThumbnailGallery;
