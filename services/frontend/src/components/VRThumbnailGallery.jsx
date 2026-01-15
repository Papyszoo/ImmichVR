import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { XR } from '@react-three/xr';
import { animated } from '@react-spring/three';

// Extracted components
import xrStore from './xr/xrStore';
import XRScrollController from './xr/XRScrollController';
import UIKitSettingsPanel from './vr-ui/uikit/UIKitSettingsPanel';
import Photo3DViewsPanel from './vr-ui/uikit/Photo3DViewsPanel';
import SettingsModal from './vr-ui/SettingsModal';
import CameraController from './gallery/CameraController';
import ThumbnailGrid from './gallery/ThumbnailGrid';
import TimelineScrubber from './gallery/TimelineScrubber';
import VRPhoto from './VRPhoto'; // Integrated for Viewer
import styles from './gallery/galleryStyles';

import { usePhotoViewerAnimation } from '../hooks/usePhotoViewerAnimation';
import { generateDepthWithModel, getPhotoFiles, deletePhotoFile, getAIModels } from '../services/api';


function ViewerItem({ photo, index, selectedIndex, onSelect }) {
  const isSelected = index === selectedIndex;
  // Calculate relative offset (handling potential wrapping if we wanted circular, but list is linear for now)
  const offset = index - selectedIndex;
  
  // Optimization: Only render relevant items
  if (Math.abs(offset) > 3) return null;

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
  
  // Auto-generate depth when entering photo view
  useEffect(() => {
    if (!selectedPhotoId || !settings.autoGenerateOnEnter) return;
    
    // Check if depth already exists in cache or in photo metadata (from backend)
    const photo = photos.find(p => p.id === selectedPhotoId);
    if (depthCache[selectedPhotoId] || photo?.depthUrl) return;
    
    console.log('Auto-generating depth for photo:', selectedPhotoId);
    
    const autoGenerate = async () => {
      try {
        const blob = await generateDepthWithModel(selectedPhotoId, settings.defaultDepthModel);
        const url = URL.createObjectURL(blob);
        setDepthCache(prev => ({ ...prev, [selectedPhotoId]: url }));
      } catch (err) {
        console.warn('Auto-generate depth failed:', err);
      }
    };
    
    autoGenerate();
  }, [selectedPhotoId, settings.autoGenerateOnEnter, settings.defaultDepthModel, photos, depthCache]);
  
  // Fetch generated files when photo is selected
  useEffect(() => {
    if (!selectedPhotoId) {
      setPhotoFiles([]);
      return;
    }
    
    getPhotoFiles(selectedPhotoId)
      .then(data => setPhotoFiles(data.files || []))
      .catch(err => console.warn('Failed to fetch photo files:', err));
  }, [selectedPhotoId]);

  // Fetch available models on mount
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
  }, []);
  
  // Handle generate depth with specific model
  const handleGenerateDepth = useCallback(async (modelKey) => {
    if (!selectedPhotoId || generatingModel) return;
    
    setGeneratingModel(modelKey);
    try {
      const blob = await generateDepthWithModel(selectedPhotoId, modelKey);
      const url = URL.createObjectURL(blob);
      setDepthCache(prev => ({ ...prev, [selectedPhotoId]: url }));
      
      // Refresh files list
      const data = await getPhotoFiles(selectedPhotoId);
      setPhotoFiles(data.files || []);
    } catch (err) {
      console.error('Failed to generate depth:', err);
    } finally {
      setGeneratingModel(null);
    }
  }, [selectedPhotoId, generatingModel]);
  
  // Handle remove generated file
  const handleRemoveFile = useCallback(async (modelKey, fileId) => {
    if (!selectedPhotoId) return;
    
    try {
      await deletePhotoFile(selectedPhotoId, fileId);
      // Refresh files list
      const data = await getPhotoFiles(selectedPhotoId);
      setPhotoFiles(data.files || []);
    } catch (err) {
      console.error('Failed to delete file:', err);
    }
  }, [selectedPhotoId]);

  
  // Track VR session state
  useEffect(() => {
    const unsubscribe = xrStore.subscribe((state) => {
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

      {/* Settings Modal */}
      {!isInVR && (
        <SettingsModal
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          settings={settings}
          onSettingsChange={setSettings}
        />
      )}

      {/* 3D Canvas */}
      <Canvas 
        style={styles.canvas}
        camera={{ position: [0, 1.6, 0], fov: 70, near: 0.1, far: 100 }}
        gl={{ antialias: true }}
      >
        <XR store={xrStore}>
          <color attach="background" args={['#000000']} />
          <ambientLight intensity={1.0} />
          <directionalLight position={[0, 5, 5]} intensity={0.3} />

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
                {/* Render current and adjacent photos */}
                {photosWithDepth.map((photo, index) => {
                   // Only render if close to selected index (optimization)
                   if (Math.abs(index - selectedIndex) > 3) return null;
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
                
                {/* 3D Views Panel on right side of current photo */}
                <Photo3DViewsPanel
                  photoId={selectedPhotoId}
                  generatedFiles={photoFiles.map(f => ({ modelKey: f.modelKey, id: f.id }))}
                  downloadedModels={downloadedModels}
                  models={availableModels}
                  activeModel={null}
                  onGenerate={handleGenerateDepth}
                  onRemove={handleRemoveFile}
                  position={[1.2, 1.6, -settings.wallDistance]}
                />
             </group>
          )}

        </XR>
      </Canvas>
    </div>
  );
}

export default VRThumbnailGallery;
