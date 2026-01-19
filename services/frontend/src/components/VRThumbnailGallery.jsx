import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
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
import { generateAsset, generateDepthWithModel, getPhotoFiles, deletePhotoFile, getAIModels, getSettings, convertPlyToKsplat } from '../services/api';


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

/**
 * VRThumbnailGallery - Main VR gallery component with 3D depth thumbnails
 */
function VRThumbnailGallery({ photos = [], initialSelectedId = null, onSelectPhoto, onClose, onLoadMore, hasMore = false, loadingMore = false }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isInVR, setIsInVR] = useState(false);
  const [settings, setSettings] = useState({
    galleryWidth: 6,        // Width in meters
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
  const [groupPositions, setGroupPositions] = useState({});
  const scrollRef = useRef(null);
  const loadMoreTriggered = useRef(false);
  
  // Viewer State
  const [selectedPhotoId, setSelectedPhotoId] = useState(initialSelectedId);
  
  // Photo 3D Views Panel state
  const [photoFiles, setPhotoFiles] = useState([]);
  const [downloadedModels, setDownloadedModels] = useState(['small']); // Keep for compatibility if needed
  const [availableModels, setAvailableModels] = useState([]); // Full model metadata
  const [generatingModel, setGeneratingModel] = useState(null);
  const generatingRef = useRef(false); // Synchronous lock to prevent multiple concurrent generate calls
  const [isConverting, setIsConverting] = useState(false); // Prevent duplicate conversion requests
  const selectingRef = useRef(false); // Synchronous lock to prevent multiple concurrent select/download calls
  const [activeDepthModel, setActiveDepthModel] = useState(null); // Currently applied depth model
  const [splatUrl, setSplatUrl] = useState(null); // URL for active Gaussian Splat
  const [splatFormat, setSplatFormat] = useState('ply'); // Format of active splat (ply, splat, ksplat, spz)
  
  // Quality Control State
  const [qualityMode, setQualityMode] = useState('HIGH'); 
  const [dpr, setDpr] = useState(1.5); // Default to decent quality (1.5 is safer than native window.devicePixelRatio)

  // Callback when lag is detected
  const handlePerformanceDrop = useCallback(() => {
    // Check setting first!
    if (settings.disableAutoQuality) {
        console.log("Performance drop detected, but auto-optimization is disabled by user.");
        return;
    }

    if (qualityMode === 'HIGH') {
      console.log("Switching to LOW quality mode due to performance.");
      setQualityMode('LOW');
      setDpr(0.75); // Drastically reduce resolution
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
  
  // Viewer position controls
  const [viewerTransform, setViewerTransform] = useState({
    positionX: 0,
    positionY: 1.8,
    positionZ: -0.4,
    scale: 0.5,
    rotationY: 0,
  });
  const [splatCount, setSplatCount] = useState(0);
  
  // Auto-generate depth when entering photo view
  useEffect(() => {
    if (!selectedPhotoId || !settings.autoGenerateOnEnter) return;
    
    // Check if depth already exists in cache or in photo metadata (from backend)
    const photo = photos.find(p => p.id === selectedPhotoId);
    if (depthCache[selectedPhotoId] || photo?.depthUrl) return;
    
    console.log('Auto-generating asset for photo:', selectedPhotoId, 'with model:', settings.defaultDepthModel);
    
    const autoGenerate = async () => {
      try {
        // Lookup model type from availableModels
        const model = availableModels.find(m => m.key === settings.defaultDepthModel);
        if (!model) {
          console.error('Auto-generate: Model not found:', settings.defaultDepthModel);
          return;
        }
        
        const assetType = model.type || 'depth'; // Default to depth for backwards compatibility
        console.log(`[VRThumbnailGallery] Auto-generating ${assetType} with model ${settings.defaultDepthModel}`);
        
        // Call generateAsset with correct type
        const blob = await generateAsset(selectedPhotoId, assetType, settings.defaultDepthModel);
        
        // For depth maps, cache the blob URL
        if (assetType === 'depth') {
          const url = URL.createObjectURL(blob);
          setDepthCache(prev => ({ ...prev, [selectedPhotoId]: url }));
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
    
    // Clear active model and splat when photo changes
    setActiveDepthModel(null);
    if (splatUrl) {
      URL.revokeObjectURL(splatUrl);
      setSplatUrl(null);
    }
    
    getPhotoFiles(selectedPhotoId)
      .then(data => setPhotoFiles(data.files || []))
      .catch(err => console.warn('Failed to fetch photo files:', err));
  }, [selectedPhotoId]); // Note: intentionally not including splatUrl to avoid loop

  // Fetch available models on mount AND when entering viewer mode
  // Re-fetching when selectedPhotoId changes ensures the 3D Views panel
  // shows fresh model status (e.g., after downloading via Settings)
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
  }, [selectedPhotoId]); // Re-fetch when photo selection changes
  
  // Handle generate asset with specific model
  const handleGenerateDepth = useCallback(async (modelKey) => {
    // Synchronous guard using ref (state updates are async and can allow multiple calls through)
    if (!selectedPhotoId || generatingRef.current) {
      console.log(`[handleGenerateDepth] Blocked: selectedPhotoId=${selectedPhotoId}, generatingRef.current=${generatingRef.current}`);
      return;
    }
    
    // Check if asset already exists (prevent duplicate generation)
    const existingFile = photoFiles.find(f => f.modelKey === modelKey);
    if (existingFile) {
      console.log(`Asset for ${modelKey} already exists, skipping generation`);
      return;
    }
    
    // Set synchronous lock immediately
    generatingRef.current = true;
    setGeneratingModel(modelKey);
    
    try {
      // Special handling for KSPLAT virtual entry - triggers conversion, not generation
      // Note: SPLAT format removed - use PLY or KSPLAT instead
      if (modelKey === 'ksplat') {
        console.log(`[VRThumbnailGallery] Converting PLY to KSPLAT`);
        
        // Call convert endpoint
        const response = await fetch(`/api/assets/${selectedPhotoId}/convert`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: 'ply', to: 'ksplat' })
        });
        
        if (!response.ok) {
          throw new Error(`Conversion failed: ${response.status}`);
        }
        
        const result = await response.json();
        console.log(`[VRThumbnailGallery] Conversion result:`, result);
        
        // Refresh files list
        const data = await getPhotoFiles(selectedPhotoId);
        setPhotoFiles(data.files || []);
        return;
      }
      
      // Lookup model type from availableModels
      const model = availableModels.find(m => m.key === modelKey);
      if (!model) {
        console.error('Model not found:', modelKey);
        return;
      }
      
      const assetType = model.type || 'depth'; // Default to depth for backwards compatibility
      console.log(`[VRThumbnailGallery] Generating ${assetType} with model ${modelKey}`);
      
      // Call generateAsset with correct type
      const blob = await generateAsset(selectedPhotoId, assetType, modelKey);
      
      // For depth maps, cache the blob URL and set as active immediately
      if (assetType === 'depth') {
        const url = URL.createObjectURL(blob);
        setDepthCache(prev => ({ ...prev, [selectedPhotoId]: url }));
        setActiveDepthModel(modelKey);
      }
      
      // Refresh files list
      const data = await getPhotoFiles(selectedPhotoId);
      setPhotoFiles(data.files || []);
    } catch (err) {
      console.error('Failed to generate asset:', err);
    } finally {
      generatingRef.current = false;
      setGeneratingModel(null);
    }
  }, [selectedPhotoId, availableModels, photoFiles]);
  
  // Handle remove generated file
  const handleRemoveFile = useCallback(async (modelKey) => {
    if (!selectedPhotoId) return;
    
    // Find the file ID for this model
    // Special handling for virtual KSPLAT entry - the file has modelKey 'sharp' but format 'ksplat'
    let file;
    if (modelKey === 'ksplat') {
      file = photoFiles.find(f => f.modelKey === 'sharp' && f.format === 'ksplat');
    } else if (modelKey === 'sharp') {
      // For SHARP model, specifically look for PLY format to avoid deleting KSPLAT
      file = photoFiles.find(f => f.modelKey === 'sharp' && f.format === 'ply');
    } else {
      // For other models, use standard lookup
      file = photoFiles.find(f => f.modelKey === modelKey);
    }
    if (!file) return;
    
    try {
      await deletePhotoFile(selectedPhotoId, file.id);
      // Refresh files list
      const data = await getPhotoFiles(selectedPhotoId);
      setPhotoFiles(data.files || []);
      
      // If the removed model was active, clear it
      if (activeDepthModel === modelKey) {
        setActiveDepthModel(null);
        // Clear from depth cache
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
  
  // Handle selecting a model to apply (depth or splat)
  const handleSelectDepth = useCallback(async (modelKey) => {
    // Synchronous guard to prevent multiple concurrent downloads
    if (!selectedPhotoId || selectingRef.current) {
      console.log(`[handleSelectDepth] Blocked: selectedPhotoId=${selectedPhotoId}, selectingRef.current=${selectingRef.current}`);
      return;
    }
    
    selectingRef.current = true;
    
    try {
      // Find the file for this model
      // Special handling for virtual KSPLAT entry - the file has modelKey 'sharp' but different format
      let file;
      if (modelKey === 'ksplat') {
        // KSPLAT is a virtual entry - look for format 'ksplat' with modelKey 'sharp'
        file = photoFiles.find(f => f.modelKey === 'sharp' && f.format === 'ksplat');
      } else if (modelKey === 'sharp') {
        // For SHARP model, specifically look for PLY format to avoid confusion with KSPLAT
        file = photoFiles.find(f => f.modelKey === 'sharp' && f.format === 'ply');
      } else {
        // For other models, use standard lookup
        file = photoFiles.find(f => f.modelKey === modelKey);
      }
      
      if (!file) {
        console.warn('No file found for model:', modelKey);
        return;
      }
      
      // For depth maps, fetch and add to cache
      if (file.type === 'depth') {
        // Clear any active splat
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
          } else {
            // If download endpoint doesn't exist, try constructing URL from file path
            // For now, just set active model - the photo may already have depth
            setActiveDepthModel(modelKey);
          }
        } catch (err) {
          console.error('Failed to fetch depth file:', err);
          // Fallback: just set active model
          setActiveDepthModel(modelKey);
        }
      } else if (file.type === 'splat') {
        // For splat models, fetch the splat file
        // SparkJS supports PLY, KSPLAT, SPLAT, and SPZ formats with web worker parsing
        console.log('Selected splat model:', modelKey, 'file:', file);
        
        try {
          const response = await fetch(`/api/assets/${selectedPhotoId}/files/${file.id}/download`);
          console.log('[Splat] Download response:', response.status, response.statusText);
          if (response.ok) {
            const blob = await response.blob();
            console.log('[Splat] Blob size:', blob.size, 'type:', blob.type);
            
            // Check for empty blob (304 Not Modified responses may not have body)
            if (blob.size === 0) {
              console.error('[Splat] Downloaded blob is empty - file may not exist or response was cached without body');
              return;
            }
            
            // Revoke previous splat URL if any
            if (splatUrl) {
              URL.revokeObjectURL(splatUrl);
            }
            
            const url = URL.createObjectURL(blob);
            setSplatUrl(url);
            setSplatFormat(file.format || 'ply'); // Set format from file metadata
            setActiveDepthModel(modelKey);
            
            // Clear depth cache for this photo so VRPhoto doesn't show depth view while splat is active
            setDepthCache(prev => {
              const newCache = { ...prev };
              delete newCache[selectedPhotoId];
              return newCache;
            });
            
            console.log('[Splat] Loaded splat URL:', url, 'format:', file.format, 'blob size:', blob.size);
          } else {
            console.error('Failed to download splat file, status:', response.status);
          }
        } catch (err) {
          console.error('Failed to fetch splat file:', err);
        }
      }
    } finally {
      selectingRef.current = false;
    }
  }, [selectedPhotoId, photoFiles, splatUrl]);
  
  // Handle KSPLAT conversion
  const handleConvert = useCallback(async (modelKey) => {
    if (modelKey === 'ksplat') {
      // Prevent duplicate requests
      if (isConverting) {
        console.log('Conversion already in progress, skipping...');
        return;
      }
      
      console.log('KSPLAT conversion triggered - calling backend...');
      setIsConverting(true);
      
      try {
        const result = await convertPlyToKsplat(selectedPhotoId);
        console.log('[Convert] Result:', result);
        
        // Refresh files to see the new KSPLAT
        const data = await getPhotoFiles(selectedPhotoId);
        setPhotoFiles(data.files || []);
      } catch (err) {
        console.error('Conversion failed:', err);
      } finally {
        setIsConverting(false);
      }
    }
  }, [selectedPhotoId, isConverting]);

  
  // Track VR session state
  useEffect(() => {
    const unsubscribe = xrStore.subscribe((state) => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('force2d') === 'true') {
         setIsInVR(false);
         return;
      }
      setIsInVR(state.session !== null);
    });
    return unsubscribe;
  }, []);
  
  // Get unique years from group positions
  const years = useMemo(() => {
    const yearSet = new Set();
    Object.values(groupPositions).forEach(pos => {
      yearSet.add(pos.year);
    });
    return Array.from(yearSet).sort((a, b) => b - a);
  }, [groupPositions]);

  // Calculate total content height
  const totalHeight = useMemo(() => {
    const rowHeight = settings.thumbnailHeight + settings.gap;
    let currentRowWidth = 0;
    let rowCount = 1;
    
    photos.forEach(photo => {
      const exif = photo.exifInfo;
      let aspectRatio = 1;
      if (photo.ratio) {
        aspectRatio = photo.ratio;
      } else if (exif?.exifImageWidth && exif?.exifImageHeight) {
        aspectRatio = exif.exifImageWidth / exif.exifImageHeight;
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
    
    return Math.max(2, rowCount * rowHeight + 2); // Add buffer
  }, [photos, settings.galleryWidth, settings.thumbnailHeight, settings.gap]);

  // Photos with depth data merged
  const photosWithDepth = useMemo(() => {
    return photos.map(photo => ({
      ...photo,
      depthUrl: depthCache[photo.id] || photo.depthUrl
    }));
  }, [photos, depthCache]);
  
  // Scroll to a specific year
  const handleScrollToYear = useCallback((year) => {
    const groupEntry = Object.entries(groupPositions).find(([_, pos]) => pos.year === year);
    if (groupEntry) {
      const targetY = groupEntry[1].y;
      setScrollY(targetY - 1.6);
    }
  }, [groupPositions]);

  // Handle Photo Selection (Enter Viewer)
  const handleSelect = useCallback((photo, position, rotation) => {
    // If not already selected, select it
    if (selectedPhotoId !== photo.id) {
       setSelectedPhotoId(photo.id);
       // Optionally use position for start animation later
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
      const scrollSpeed = 0.002;
      setScrollY(prev => {
        const newY = prev - e.deltaY * scrollSpeed;
        return Math.max(-(totalHeight - 1), Math.min(1, newY));
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

      const scrollSpeed = 0.2;
      if (e.key === 'ArrowUp' || e.key === 'w') {
        setScrollY(prev => Math.min(1, prev + scrollSpeed));
      } else if (e.key === 'ArrowDown' || e.key === 's') {
        setScrollY(prev => Math.max(-(totalHeight - 1), prev - scrollSpeed));
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
  
  // Load more trigger
  useEffect(() => {
    if (selectedPhotoId) return; // Don't trigger load more in viewer... or maybe we should?

    const scrolledAmount = -scrollY;
    const threshold = totalHeight - 3; 
    
    if (scrolledAmount > threshold && hasMore && !loadingMore && onLoadMore) {
      if (!loadMoreTriggered.current) {
        loadMoreTriggered.current = true;
        onLoadMore();
      }
    } else if (scrolledAmount < threshold - 1) {
      loadMoreTriggered.current = false;
    }
  }, [scrollY, totalHeight, hasMore, loadingMore, onLoadMore, selectedPhotoId]);

  // Derived selected index
  const selectedIndex = useMemo(() => {
    if (!selectedPhotoId) return -1;
    return photos.findIndex(p => p.id === selectedPhotoId);
  }, [photos, selectedPhotoId]);

  // --- TEST BRIDGE ---
  // Expose internal state and actions for Playwright E2E testing
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
          photos // Expose photos list to find IDs
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
      ) : (
        <button style={styles.backButton} onClick={onClose}>
          ← Back
        </button>
      )}

      {/* VR Button */}
      <button style={styles.vrButton} onClick={() => xrStore.enterVR()}>
        🥽 Enter VR
      </button>
      
      {/* Timeline Scrubber (Hide in Viewer) */}
      {!selectedPhotoId && (
        <TimelineScrubber 
          groupPositions={groupPositions}
          onScrollToYear={handleScrollToYear}
          years={years}
        />
      )}

      {/* Scroll indicator (Hide in Viewer) */}
      {!selectedPhotoId && (
        <div style={styles.scrollIndicator}>
          <div 
            style={{
              ...styles.scrollThumb,
              height: `${Math.max(10, (2 / totalHeight) * 100)}%`,
              top: `${Math.max(0, Math.min(90, ((1 - scrollY) / (totalHeight + 1)) * 100))}%`
            }}
          />
        </div>
      )}

      {/* Hint */}
      <div style={styles.scrollHint}>
        {selectedPhotoId 
          ? 'Use thumbstick or arrow keys to navigate' 
          : (loadingMore 
              ? 'Loading more photos...' 
              : `Scroll or use ↑↓ to navigate • ${photos.length} photos${hasMore ? '+' : ''}`
            )
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

          {/* UIKit Settings Panel (renders in 3D space) */}
          <UIKitSettingsPanel
            isOpen={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            settings={settings}
            onSettingsChange={setSettings}
          />

          {/* Render Grid if NO photo selected */}
          {!selectedPhotoId && (
             <ThumbnailGrid
              photos={photosWithDepth}
              onSelectPhoto={handleSelect}
              settings={settings}
              setSettings={setSettings}
              settingsOpen={settingsOpen}
              setSettingsOpen={setSettingsOpen}
              scrollY={scrollY}
              depthCache={depthCache}
              groupPositions={groupPositions}
              setGroupPositions={setGroupPositions}
            />
          )}

          {/* Render Viewer if photo SELECTED */}
          {selectedPhotoId && (
             <group position={[0, 0, 0]}>
                {/* Render current and adjacent photos - HIDE when splat is active */}
                {!(splatUrl && (splatFormat === 'ksplat' || splatFormat === 'splat' || splatFormat === 'ply' || splatFormat === 'spz')) && photosWithDepth.map((photo, index) => {
                   // Only render if close to selected index (optimization)
                   if (Math.abs(index - selectedIndex) > 5) return null;
                   return (
                      <ViewerItem 
                        key={photo.id}
                        photo={photo}
                        index={index}
                        selectedIndex={selectedIndex}
                        onSelect={handleSelect} // Clicking adjacent selects it
                      />
                   );
                })}

                {/* VR Back Button - positioned in the gap below main photo */}
                <BackToGridButton onClick={handleCloseViewer} />
                
                {/* Gaussian Splat Viewer - renders for PLY, KSPLAT, SPLAT, and SPZ formats (SparkJS supports all) */}
                {splatUrl && (splatFormat === 'ksplat' || splatFormat === 'splat' || splatFormat === 'ply' || splatFormat === 'spz') && (
                  <GaussianSplatViewer
                    splatUrl={splatUrl}
                    quality={qualityMode}
                    fileType={splatFormat}  /* Explicit format for blob URLs (required for ksplat, splat) */
                    testMode={false}  /* Using our splat file */
                    position={[viewerTransform.positionX, viewerTransform.positionY, viewerTransform.positionZ]}
                    rotation={[Math.PI, viewerTransform.rotationY * (Math.PI / 180), 0]}
                    scale={viewerTransform.scale}
                    onLoad={(mesh, count) => {
                      console.log(`[Splat] Viewer loaded (${splatFormat}) count=${count}`);
                      setSplatCount(count || 0);
                    }}
                    onError={(err) => console.error('[Splat] Viewer error:', err)}
                  />
                )}
                
                {/* Position controls panel on left side */}
                <ViewerPositionPanel
                  transform={viewerTransform}
                  onTransformChange={setViewerTransform}
                  splatCount={splatCount}
                  position={[-2.5, 1.6, -settings.wallDistance]}
                />
                
                {/* 3D Views Panel on right side of current photo */}
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
