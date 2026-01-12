import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { createXRStore, XR, useXR, useXRInputSourceState } from '@react-three/xr';
import { Text, Html } from '@react-three/drei';
import DepthThumbnail from './DepthThumbnail';
import { generateImmichDepth } from '../services/api';

// Create XR store for managing VR sessions
const xrStore = createXRStore();

// Export store for external access
if (typeof window !== 'undefined') {
  window.xrStore = xrStore;
}

/**
 * XRScrollController - Handles scrolling using VR controller thumbsticks
 * Uses the official @react-three/xr v6 API from documentation:
 * https://pmndrs.github.io/xr/docs/tutorials/gamepad
 */
function XRScrollController({ setScrollY, totalHeight, setSettingsOpen }) {
  // Use the official hook to get controller state
  const leftController = useXRInputSourceState('controller', 'left');
  const rightController = useXRInputSourceState('controller', 'right');
  
  const lastToggleTime = useRef(0);
  const scrollAccumulator = useRef(0);
  const lastInputY = useRef(0);
  const debugLogCount = useRef(0);
  
  useFrame((_, delta) => {
    // Debug logging (first 3 frames when controller connected)
    if (debugLogCount.current < 3 && (leftController || rightController)) {
      debugLogCount.current++;
      console.log('[XRScrollController] Controllers detected!');
      console.log('  Left:', leftController ? 'connected' : 'none');
      console.log('  Right:', rightController ? 'connected' : 'none');
      if (rightController?.gamepad) {
        console.log('  Right gamepad keys:', Object.keys(rightController.gamepad));
      }
    }
    
    let totalInputY = 0;
    let settingsPressed = false;
    
    // Process right controller (primary for scrolling)
    if (rightController?.gamepad) {
      const gamepad = rightController.gamepad;
      
      // Access thumbstick via the xr-standard-thumbstick property (per documentation)
      const thumbstick = gamepad['xr-standard-thumbstick'];
      if (thumbstick) {
        const yAxis = thumbstick.yAxis ?? 0;
        if (Math.abs(yAxis) > 0.15) {
          totalInputY = yAxis;
        }
      }
      
      // Check buttons - use named properties from xr-standard-gamepad mapping
      const aButton = gamepad['a-button'];
      const bButton = gamepad['b-button'];
      const thumbstickButton = gamepad['xr-standard-thumbstick'];
      
      if (aButton?.state === 'pressed' || bButton?.state === 'pressed') {
        settingsPressed = true;
      }
      // Thumbstick click as alternative
      if (thumbstickButton?.state === 'pressed') {
        settingsPressed = true;
      }
    }
    
    // Process left controller (secondary)
    if (leftController?.gamepad) {
      const gamepad = leftController.gamepad;
      
      const thumbstick = gamepad['xr-standard-thumbstick'];
      if (thumbstick) {
        const yAxis = thumbstick.yAxis ?? 0;
        // Use left stick if right isn't providing input
        if (Math.abs(yAxis) > 0.15 && Math.abs(yAxis) > Math.abs(totalInputY)) {
          totalInputY = yAxis;
        }
      }
      
      // Check X/Y buttons on left controller
      const xButton = gamepad['x-button'];
      const yButton = gamepad['y-button'];
      
      if (xButton?.state === 'pressed' || yButton?.state === 'pressed') {
        settingsPressed = true;
      }
    }
    
    // Apply scrolling with smoothing
    if (Math.abs(totalInputY) > 0.1) {
      const smoothedInput = lastInputY.current * 0.3 + totalInputY * 0.7;
      lastInputY.current = smoothedInput;
      
      const acceleration = Math.pow(Math.abs(smoothedInput), 1.5);
      const scrollSpeed = 3.0 * delta * acceleration * Math.sign(smoothedInput);
      
      scrollAccumulator.current += scrollSpeed;
      
      if (Math.abs(scrollAccumulator.current) > 0.01) {
        setScrollY(prev => {
          const newY = prev - scrollAccumulator.current;
          return Math.max(-(totalHeight - 1), Math.min(1, newY));
        });
        scrollAccumulator.current = 0;
      }
    } else {
      lastInputY.current = 0;
    }
    
    // Handle settings toggle with debounce
    if (settingsPressed) {
      const now = Date.now();
      if (now - lastToggleTime.current > 500) {
        lastToggleTime.current = now;
        setSettingsOpen(prev => !prev);
        console.log('[XRScrollController] Settings toggled!');
      }
    }
  });

  return null;
}

/**
 * VRSettingsPanel - 3D version of settings modal for VR
 * Displays in world-space and follows the user's view
 */
function VRSettingsPanel({ isOpen, onClose, settings, onSettingsChange }) {
  if (!isOpen) return null;
  
  const sliderStyle = { width: '100%', height: '8px', cursor: 'pointer' };
  const labelStyle = { display: 'block', marginBottom: '5px', fontSize: '14px', color: '#ccc' };
  const settingStyle = { marginBottom: '12px' };
  
  return (
    <Html
      position={[0, 1.5, -2.0]}
      scale={0.08}
      transform
      style={{
        width: '450px',
        userSelect: 'none',
        pointerEvents: 'auto'
      }}
    >
      <div style={{
        backgroundColor: 'rgba(26, 26, 26, 0.95)',
        padding: '20px',
        borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.2)',
        color: 'white',
        boxShadow: '0 0 30px rgba(0,0,0,0.7)',
        maxHeight: '500px',
        overflowY: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '18px' }}>VR Settings</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', fontSize: '24px', cursor: 'pointer', padding: '0 4px' }}>×</button>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Depth Toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <label style={{ fontSize: '14px' }}>Enable 3D Depth Effect</label>
            <input 
              type="checkbox" 
              checked={settings.enableGridDepth}
              onChange={(e) => onSettingsChange({ ...settings, enableGridDepth: e.target.checked })}
              style={{ width: '24px', height: '24px', cursor: 'pointer' }}
            />
          </div>
          
          {/* Gallery Width */}
          <div style={settingStyle}>
            <label style={labelStyle}>Gallery Width: {settings.galleryWidth.toFixed(1)}m</label>
            <input 
              type="range" min="4" max="12" step="0.5"
              value={settings.galleryWidth}
              onChange={(e) => onSettingsChange({ ...settings, galleryWidth: parseFloat(e.target.value) })}
              style={sliderStyle}
            />
          </div>
          
          {/* Distance Slider */}
          <div style={settingStyle}>
            <label style={labelStyle}>Wall Distance: {settings.wallDistance.toFixed(1)}m</label>
            <input 
              type="range" min="2" max="6" step="0.5"
              value={settings.wallDistance}
              onChange={(e) => onSettingsChange({ ...settings, wallDistance: parseFloat(e.target.value) })}
              style={sliderStyle}
            />
          </div>

          {/* Size Slider */}
          <div style={settingStyle}>
            <label style={labelStyle}>Thumbnail Size: {(settings.thumbnailHeight * 100).toFixed(0)}cm</label>
            <input 
              type="range" min="0.3" max="1.0" step="0.05"
              value={settings.thumbnailHeight}
              onChange={(e) => onSettingsChange({ ...settings, thumbnailHeight: parseFloat(e.target.value) })}
              style={sliderStyle}
            />
          </div>
          
          {/* Curve Slider */}
          <div style={settingStyle}>
            <label style={labelStyle}>Wall Curvature: {settings.wallCurvature === 0 ? 'Flat' : `${(settings.wallCurvature * 100).toFixed(0)}%`}</label>
            <input 
              type="range" min="0" max="1" step="0.1"
              value={settings.wallCurvature}
              onChange={(e) => onSettingsChange({ ...settings, wallCurvature: parseFloat(e.target.value) })}
              style={sliderStyle}
            />
          </div>
          
          {/* Depth Intensity */}
          <div style={settingStyle}>
            <label style={labelStyle}>Depth Intensity: {(settings.depthScale * 100).toFixed(0)}%</label>
            <input 
              type="range" min="0" max="0.2" step="0.01"
              value={settings.depthScale}
              onChange={(e) => onSettingsChange({ ...settings, depthScale: parseFloat(e.target.value) })}
              style={sliderStyle}
            />
          </div>
          
          {/* Spacing Slider */}
          <div style={settingStyle}>
            <label style={labelStyle}>Spacing: {(settings.gap * 100).toFixed(0)}%</label>
            <input 
              type="range" min="0.02" max="0.15" step="0.01"
              value={settings.gap}
              onChange={(e) => onSettingsChange({ ...settings, gap: parseFloat(e.target.value) })}
              style={sliderStyle}
            />
          </div>
          
          {/* Instructions */}
          <div style={{ marginTop: '12px', padding: '10px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '12px', color: '#888' }}>
            <strong>Controls:</strong><br/>
            • Thumbstick: Scroll up/down<br/>
            • A/X or B/Y button: Toggle this menu
          </div>
        </div>
      </div>
    </Html>
  );
}

/**
 * SettingsModal - Modal with sliders for configuring gallery settings
 */
function SettingsModal({ isOpen, onClose, settings, onSettingsChange }) {
  if (!isOpen) return null;

  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.modal} onClick={e => e.stopPropagation()}>
        <div style={modalStyles.header}>
          <h3 style={modalStyles.title}>Gallery Settings</h3>
          <button style={modalStyles.closeButton} onClick={onClose}>×</button>
        </div>
        
        <div style={modalStyles.content}>
          {/* Gallery Width Slider */}
          <div style={modalStyles.setting}>
            <label style={modalStyles.label}>
              Gallery Width: {settings.galleryWidth.toFixed(1)}m
            </label>
            <input
              type="range"
              min="4"
              max="12"
              step="0.5"
              value={settings.galleryWidth}
              onChange={(e) => onSettingsChange({ ...settings, galleryWidth: parseFloat(e.target.value) })}
              style={modalStyles.slider}
            />
            <div style={modalStyles.sliderLabels}>
              <span>Narrow</span>
              <span>Wide</span>
            </div>
          </div>

          {/* Thumbnail Height Slider */}
          <div style={modalStyles.setting}>
            <label style={modalStyles.label}>
              Thumbnail Size: {(settings.thumbnailHeight * 100).toFixed(0)}cm
            </label>
            <input
              type="range"
              min="0.3"
              max="1.0"
              step="0.05"
              value={settings.thumbnailHeight}
              onChange={(e) => onSettingsChange({ ...settings, thumbnailHeight: parseFloat(e.target.value) })}
              style={modalStyles.slider}
            />
            <div style={modalStyles.sliderLabels}>
              <span>Small</span>
              <span>Large</span>
            </div>
          </div>

          {/* Wall Curvature Slider */}
          <div style={modalStyles.setting}>
            <label style={modalStyles.label}>
              Wall Curvature: {settings.wallCurvature === 0 ? 'Flat' : `${(settings.wallCurvature * 100).toFixed(0)}%`}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={settings.wallCurvature}
              onChange={(e) => onSettingsChange({ ...settings, wallCurvature: parseFloat(e.target.value) })}
              style={modalStyles.slider}
            />
            <div style={modalStyles.sliderLabels}>
              <span>Flat</span>
              <span>Curved</span>
            </div>
          </div>

          {/* Depth Intensity Slider */}
          <div style={modalStyles.setting}>
            <label style={modalStyles.label}>
              Depth Intensity: {(settings.depthScale * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min="0"
              max="0.4"
              step="0.02"
              value={settings.depthScale}
              onChange={(e) => onSettingsChange({ ...settings, depthScale: parseFloat(e.target.value) })}
              style={modalStyles.slider}
            />
            <div style={modalStyles.sliderLabels}>
              <span>Subtle</span>
              <span>Strong</span>
            </div>
          </div>

          {/* Spacing Slider */}
          <div style={modalStyles.setting}>
            <label style={modalStyles.label}>
              Spacing: {(settings.gap * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min="0.02"
              max="0.15"
              step="0.01"
              value={settings.gap}
              onChange={(e) => onSettingsChange({ ...settings, gap: parseFloat(e.target.value) })}
              style={modalStyles.slider}
            />
            <div style={modalStyles.sliderLabels}>
              <span>Tight</span>
              <span>Loose</span>
            </div>
          </div>

          {/* Distance Slider */}
          <div style={modalStyles.setting}>
            <label style={modalStyles.label}>
              Distance: {settings.wallDistance.toFixed(1)}m
            </label>
            <input
              type="range"
              min="2"
              max="6"
              step="0.5"
              value={settings.wallDistance}
              onChange={(e) => onSettingsChange({ ...settings, wallDistance: parseFloat(e.target.value) })}
              style={modalStyles.slider}
            />
            <div style={modalStyles.sliderLabels}>
              <span>Close</span>
              <span>Far</span>
            </div>
          </div>
          
          {/* Grid Depth Toggle */}
          <div style={{ ...modalStyles.setting, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={modalStyles.label}>
              Enable Depth in Grid (Heavy)
            </label>
            <input
              type="checkbox"
              checked={settings.enableGridDepth}
              onChange={(e) => onSettingsChange({ ...settings, enableGridDepth: e.target.checked })}
              style={{ width: '20px', height: '20px', cursor: 'pointer' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * CameraController - Handles scroll via camera movement and ensures camera looks forward
 */
function CameraController({ scrollY }) {
  const { camera } = useThree();
  const targetY = useRef(1.6);
  const initialized = useRef(false);
  
  useEffect(() => {
    targetY.current = 1.6 + scrollY;
  }, [scrollY]);
  
  useFrame(() => {
    // Ensure camera looks at -Z on first frame
    if (!initialized.current) {
      camera.position.set(0, 1.6, 0);
      camera.lookAt(0, 1.6, -10);
      initialized.current = true;
    }
    
    // Smooth camera Y position (keep looking forward)
    const newY = camera.position.y + (targetY.current - camera.position.y) * 0.1;
    camera.position.y = newY;
    camera.lookAt(0, newY, -10);
  });
  
  return null;
}

/**
 * Group photos by month/year like Immich
 */
function groupPhotosByDate(photos) {
  const groups = {};
  
  photos.forEach(photo => {
    const dateStr = photo.fileCreatedAt || photo.localDateTime || photo.createdAt;
    const date = dateStr ? new Date(dateStr) : new Date();
    const key = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    
    if (!groups[key]) {
      groups[key] = {
        label: key,
        date: date,
        year: date.getFullYear(),
        photos: []
      };
    }
    groups[key].photos.push(photo);
  });
  
  // Sort groups by date (newest first)
  return Object.values(groups).sort((a, b) => b.date - a.date);
}

/**
 * ThumbnailGrid - The 3D grid of depth thumbnails with flex-like row layout
 */
function ThumbnailGrid({ 
  photos, 
  onSelectPhoto, 
  settings,
  setSettings,
  settingsOpen,
  setSettingsOpen,
  scrollY,
  depthCache,
  groupPositions,
  setGroupPositions
}) {
  const { galleryWidth, wallCurvature, depthScale, gap, thumbnailHeight, wallDistance } = settings;
  
  // Group photos by date
  const dateGroups = useMemo(() => groupPhotosByDate(photos), [photos]);
  
  // Calculate row-based layout with date groups
  const layoutData = useMemo(() => {
    const allRows = [];
    const maxRowWidth = galleryWidth;
    const groupRefs = {};
    let globalY = 1.2; // Starting Y position
    const rowHeight = thumbnailHeight + gap;
    const headerHeight = 0.3; // Height for date headers
    
    dateGroups.forEach((group) => {
      // Record the Y position for this group (for timeline navigation)
      groupRefs[group.label] = { y: globalY, year: group.year };
      
      // Add header row
      allRows.push({
        type: 'header',
        label: group.label,
        y: globalY,
        year: group.year
      });
      globalY -= headerHeight;
      
      // Layout photos in rows
      let currentRow = [];
      let currentRowWidth = 0;
      
      group.photos.forEach((photo, index) => {
        // Calculate thumbnail width based on aspect ratio
        // Calculate thumbnail width based on aspect ratio
        const exif = photo.exifInfo;
        let aspectRatio = 1;
        if (photo.ratio) {
          aspectRatio = photo.ratio;
        } else if (exif?.exifImageWidth && exif?.exifImageHeight) {
          aspectRatio = exif.exifImageWidth / exif.exifImageHeight;
        }
        aspectRatio = Math.max(0.5, Math.min(2.5, aspectRatio));
        
        const thumbWidth = thumbnailHeight * aspectRatio;
        const itemWidth = thumbWidth + gap;
        
        // Check if this item fits in current row
        if (currentRowWidth + thumbWidth > maxRowWidth && currentRow.length > 0) {
          allRows.push({ 
            type: 'photos',
            items: currentRow, 
            totalWidth: currentRowWidth - gap,
            y: globalY
          });
          globalY -= rowHeight;
          currentRow = [];
          currentRowWidth = 0;
        }
        
        currentRow.push({
          photo,
          index,
          width: thumbWidth,
          xOffset: currentRowWidth
        });
        currentRowWidth += itemWidth;
      });
      
      // Add last row for this group
      if (currentRow.length > 0) {
        allRows.push({ 
          type: 'photos',
          items: currentRow, 
          totalWidth: currentRowWidth - gap,
          y: globalY
        });
        globalY -= rowHeight;
      }
      
      // Add spacing between groups
      globalY -= gap * 2;
    });
    
    return { rows: allRows, groupRefs };
  }, [photos, dateGroups, galleryWidth, thumbnailHeight, gap]);
  
  // Update group positions for timeline navigation
  useEffect(() => {
    if (setGroupPositions && layoutData.groupRefs) {
      setGroupPositions(layoutData.groupRefs);
    }
  }, [layoutData.groupRefs, setGroupPositions]);
  
  // Calculate positions for all items
  const allItems = useMemo(() => {
    const items = [];
    const headers = [];
    
    layoutData.rows.forEach((row) => {
      if (row.type === 'header') {
        headers.push({
          label: row.label,
          position: [0, row.y, -wallDistance],
          year: row.year
        });
        return;
      }
      
      // Center the row
      const rowStartX = -row.totalWidth / 2;
      
      row.items.forEach((item) => {
        // Calculate base X position (centered in row)
        const baseX = rowStartX + item.xOffset + item.width / 2;
        
        let x, z, rotationY;
        
        if (wallCurvature > 0) {
          // FIXED: Curved wall positioning
          // Use arc length to maintain proper spacing
          // arcLength = angle * radius, so angle = arcLength / radius
          const arcAngle = (baseX / wallDistance) * wallCurvature;
          
          // Position on the curved wall
          x = Math.sin(arcAngle) * wallDistance;
          z = -Math.cos(arcAngle) * wallDistance;
          rotationY = arcAngle;
        } else {
          // Flat wall
          x = baseX;
          z = -wallDistance;
          rotationY = 0;
        }
        
        items.push({
          ...item,
          position: [x, row.y, z],
          rotation: [0, rotationY, 0],
          depthUrl: depthCache[item.photo.id]
        });
      });
    });
    
    return { items, headers };
  }, [layoutData, wallCurvature, wallDistance, depthCache]);
  
  // Filter to only visible items based on camera position
  // Also calculate distance for adaptive parallax quality
  const visibleData = useMemo(() => {
    const cameraY = 1.6 + scrollY;
    const viewHeight = 4; // Visible height buffer
    const cameraPos = [0, cameraY, 0];
    
    const visibleItems = allItems.items.filter(item => {
      const itemY = item.position[1];
      return itemY > cameraY - viewHeight && itemY < cameraY + viewHeight;
    }).map(item => {
      // Calculate distance from camera for LOD
      const dx = item.position[0] - cameraPos[0];
      const dy = item.position[1] - cameraPos[1];
      const dz = item.position[2] - cameraPos[2];
      const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
      
      return {
        ...item,
        distance,
        // Use simple parallax for items farther than 2.5m (less accurate but faster)
        useSimpleParallax: distance > 2.5
      };
    });
    
    const visibleHeaders = allItems.headers.filter(header => {
      return header.position[1] > cameraY - viewHeight && header.position[1] < cameraY + viewHeight;
    });
    
    return { items: visibleItems, headers: visibleHeaders };
  }, [allItems, scrollY]);

  return (
    <group>
      {/* Title */}
      <Text
        position={[0, 2.0, -wallDistance]}
        fontSize={0.2}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
      >
        VR Photo Gallery
      </Text>
      
      {/* Photo count */}
      <Text
        position={[0, 1.8, -wallDistance]}
        fontSize={0.08}
        color="#666666"
        anchorX="center"
        anchorY="middle"
      >
        {photos.length} photos • {visibleData.items.length} visible
      </Text>
      
      {/* Date headers */}
      {visibleData.headers.map((header) => (
        <Text
          key={header.label}
          position={header.position}
          fontSize={0.12}
          color="#888888"
          anchorX="center"
          anchorY="middle"
        >
          {header.label}
        </Text>
      ))}

      {/* Thumbnails */}
      {visibleData.items.map(({ photo, position, rotation, depthUrl, useSimpleParallax }) => (
        <DepthThumbnail
          key={photo.id}
          photo={{ ...photo, depthUrl }}
          position={position}
          rotation={rotation}
          onSelect={onSelectPhoto}
          depthScale={depthScale}
          thumbnailHeight={thumbnailHeight}
          enableDepth={settings.enableGridDepth}
          useSimpleParallax={useSimpleParallax}
        />
      ))}
      
      {/* VR Settings Panel */}
      <VRSettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSettingsChange={setSettings}
      />
    </group>
  );
}

/**
 * TimelineScrubber - Year buttons for quick navigation (HTML overlay)
 */
function TimelineScrubber({ groupPositions, onScrollToYear, years }) {
  if (!years || years.length === 0) return null;
  
  return (
    <div style={styles.timeline}>
      {years.map(year => (
        <button
          key={year}
          style={styles.yearButton}
          onClick={() => onScrollToYear(year)}
        >
          {year}
        </button>
      ))}
    </div>
  );
}

/**
 * VRThumbnailGallery - Main VR gallery component with 3D depth thumbnails
 */
function VRThumbnailGallery({ photos = [], onSelectPhoto, onClose, onLoadMore, hasMore = false, loadingMore = false }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isInVR, setIsInVR] = useState(false);
  const [settings, setSettings] = useState({
    galleryWidth: 6,        // Width in meters
    thumbnailHeight: 0.5,   // Height in meters (50cm)
    wallCurvature: 0,       // 0 = flat, 1 = fully curved
    depthScale: 0.1,        // Depth displacement amount
    gap: 0.05,              // Gap between thumbnails
    wallDistance: 3,        // Distance from viewer
    enableGridDepth: false  // Toggle depth in grid view
  });
  const [scrollY, setScrollY] = useState(0);
  const [depthCache, setDepthCache] = useState({});
  const [groupPositions, setGroupPositions] = useState({});
  const scrollRef = useRef(null);
  const loadMoreTriggered = useRef(false);
  
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
    // Find the first group for this year
    const groupEntry = Object.entries(groupPositions).find(([_, pos]) => pos.year === year);
    if (groupEntry) {
      const targetY = groupEntry[1].y;
      // scrollY is negative when scrolling down, and it offsets from 1.6 (eye level)
      // We want camera at targetY, so scrollY = targetY - 1.6
      setScrollY(targetY - 1.6);
    }
  }, [groupPositions]);

  // Scroll with mouse wheel
  useEffect(() => {
    const handleWheel = (e) => {
      e.preventDefault();
      const scrollSpeed = 0.002;
      setScrollY(prev => {
        const newY = prev - e.deltaY * scrollSpeed;
        // Clamp to content bounds (scroll down = negative scrollY)
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
  }, [totalHeight]);

  // Scroll with keyboard
  useEffect(() => {
    const handleKeyDown = (e) => {
      const scrollSpeed = 0.2;
      if (e.key === 'ArrowUp' || e.key === 'w') {
        setScrollY(prev => Math.min(1, prev + scrollSpeed));
      } else if (e.key === 'ArrowDown' || e.key === 's') {
        setScrollY(prev => Math.max(-(totalHeight - 1), prev - scrollSpeed));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [totalHeight]);

  // Cleanup depth URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(depthCache).forEach(url => {
        if (url && url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, []);
  
  // Trigger load more when scrolling near the end
  useEffect(() => {
    // Calculate how far we've scrolled (negative scrollY means scrolled down)
    const scrolledAmount = -scrollY;
    const threshold = totalHeight - 3; // Load more when 3 meters from bottom
    
    if (scrolledAmount > threshold && hasMore && !loadingMore && onLoadMore) {
      if (!loadMoreTriggered.current) {
        loadMoreTriggered.current = true;
        onLoadMore();
      }
    } else if (scrolledAmount < threshold - 1) {
      // Reset trigger when scrolling back up
      loadMoreTriggered.current = false;
    }
  }, [scrollY, totalHeight, hasMore, loadingMore, onLoadMore]);

  return (
    <div ref={scrollRef} style={styles.container}>
      {/* Settings Button */}
      <button 
        style={styles.settingsButton}
        onClick={() => setSettingsOpen(true)}
      >
        ⚙️ Settings
      </button>

      {/* Back Button */}
      <button style={styles.backButton} onClick={onClose}>
        ← Back
      </button>

      {/* VR Button */}
      <button style={styles.vrButton} onClick={() => xrStore.enterVR()}>
        🥽 Enter VR
      </button>
      
      {/* Timeline Scrubber */}
      <TimelineScrubber 
        groupPositions={groupPositions}
        onScrollToYear={handleScrollToYear}
        years={years}
      />

      {/* Scroll indicator */}
      <div style={styles.scrollIndicator}>
        <div 
          style={{
            ...styles.scrollThumb,
            height: `${Math.max(10, (2 / totalHeight) * 100)}%`,
            top: `${Math.max(0, Math.min(90, ((1 - scrollY) / (totalHeight + 1)) * 100))}%`
          }}
        />
      </div>

      {/* Scroll hint */}
      <div style={styles.scrollHint}>
        {loadingMore 
          ? 'Loading more photos...' 
          : `Scroll or use ↑↓ to navigate • ${photos.length} photos${hasMore ? '+' : ''}`
        }
      </div>

      {/* Settings Modal - only show when NOT in VR */}
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
          {/* Black background */}
          <color attach="background" args={['#000000']} />
          <ambientLight intensity={1.0} />
          <directionalLight position={[0, 5, 5]} intensity={0.3} />

          <CameraController scrollY={scrollY} />
          <XRScrollController setScrollY={setScrollY} totalHeight={totalHeight} setSettingsOpen={setSettingsOpen} />

          <ThumbnailGrid
            photos={photosWithDepth}
            onSelectPhoto={onSelectPhoto}
            settings={settings}
            setSettings={setSettings}
            settingsOpen={settingsOpen}
            setSettingsOpen={setSettingsOpen}
            scrollY={scrollY}
            depthCache={depthCache}
            groupPositions={groupPositions}
            setGroupPositions={setGroupPositions}
          />
        </XR>
      </Canvas>
    </div>
  );
}

const styles = {
  container: {
    position: 'relative',
    width: '100vw',
    height: '100vh',
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  canvas: {
    width: '100%',
    height: '100%',
  },
  settingsButton: {
    position: 'absolute',
    top: '16px',
    right: '140px',
    zIndex: 100,
    padding: '10px 16px',
    fontSize: '14px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: 'white',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '8px',
    cursor: 'pointer',
    backdropFilter: 'blur(8px)',
  },
  backButton: {
    position: 'absolute',
    top: '16px',
    left: '16px',
    zIndex: 100,
    padding: '10px 16px',
    fontSize: '14px',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    color: 'white',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '8px',
    cursor: 'pointer',
    backdropFilter: 'blur(8px)',
  },
  vrButton: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    zIndex: 100,
    padding: '10px 16px',
    fontSize: '14px',
    backgroundColor: 'rgba(76, 175, 80, 0.9)',
    color: 'white',
    border: 'none',
    borderRadius: '20px',
    cursor: 'pointer',
  },
  timeline: {
    position: 'absolute',
    right: '20px',
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    zIndex: 100,
  },
  yearButton: {
    background: 'rgba(255,255,255,0.1)',
    border: 'none',
    color: '#888888',
    fontSize: '11px',
    padding: '6px 10px',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  scrollIndicator: {
    position: 'absolute',
    right: '8px',
    top: '60px',
    bottom: '60px',
    width: '4px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '2px',
    zIndex: 99,
  },
  scrollThumb: {
    position: 'absolute',
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: '2px',
    minHeight: '20px',
  },
  scrollHint: {
    position: 'absolute',
    bottom: '16px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 100,
    padding: '8px 16px',
    fontSize: '12px',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    color: '#888888',
    borderRadius: '12px',
  },
};

const modalStyles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  modal: {
    backgroundColor: '#1a1a1a',
    borderRadius: '16px',
    padding: '24px',
    minWidth: '320px',
    maxWidth: '400px',
    maxHeight: '80vh',
    overflowY: 'auto',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '600',
    color: '#ffffff',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    color: '#888888',
    cursor: 'pointer',
    padding: '0 8px',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  setting: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    color: '#cccccc',
    fontWeight: '500',
  },
  slider: {
    width: '100%',
    height: '6px',
    borderRadius: '3px',
    background: '#333333',
    outline: 'none',
    cursor: 'pointer',
    WebkitAppearance: 'none',
  },
  sliderLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '11px',
    color: '#666666',
  },
};

export default VRThumbnailGallery;
