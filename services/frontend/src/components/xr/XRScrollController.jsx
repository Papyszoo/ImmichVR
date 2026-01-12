import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useXRInputSourceState } from '@react-three/xr';

/**
 * XRScrollController - Handles scrolling using VR controller thumbsticks
 * Also handles viewer navigation (next/prev photo, exit viewer)
 * Uses the official @react-three/xr v6 API from documentation:
 * https://pmndrs.github.io/xr/docs/tutorials/gamepad
 */
function XRScrollController({ 
  setScrollY, 
  totalHeight, 
  setSettingsOpen,
  isViewerMode = false,
  onNextPhoto,
  onPrevPhoto,
  onCloseViewer
}) {
  // Use the official hook to get controller state
  const leftController = useXRInputSourceState('controller', 'left');
  const rightController = useXRInputSourceState('controller', 'right');
  
  const lastToggleTime = useRef(0);
  const scrollAccumulator = useRef(0);
  const lastInputY = useRef(0);
  const debugLogCount = useRef(0);
  const lastNavTime = useRef(0); // Debounce for photo navigation
  const lastExitTime = useRef(0); // Debounce for B button
  
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
    let totalInputX = 0;
    let settingsPressed = false;
    let bButtonPressed = false;
    
    // Process right controller (primary for scrolling)
    if (rightController?.gamepad) {
      const gamepad = rightController.gamepad;
      
      // Access thumbstick via the xr-standard-thumbstick property (per documentation)
      const thumbstick = gamepad['xr-standard-thumbstick'];
      if (thumbstick) {
        const yAxis = thumbstick.yAxis ?? 0;
        const xAxis = thumbstick.xAxis ?? 0;
        if (Math.abs(yAxis) > 0.15) {
          totalInputY = yAxis;
        }
        if (Math.abs(xAxis) > 0.5) {
          totalInputX = xAxis;
        }
      }
      
      // Check buttons - use named properties from xr-standard-gamepad mapping
      const aButton = gamepad['a-button'];
      const bButton = gamepad['b-button'];
      const thumbstickButton = gamepad['xr-standard-thumbstick'];
      
      // B button for exit viewer
      if (bButton?.state === 'pressed') {
        bButtonPressed = true;
      }
      
      // A button for settings toggle (only in grid mode)
      if (aButton?.state === 'pressed') {
        settingsPressed = true;
      }
      
      // Thumbstick click as alternative for settings
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
        const xAxis = thumbstick.xAxis ?? 0;
        // Use left stick if right isn't providing input
        if (Math.abs(yAxis) > 0.15 && Math.abs(yAxis) > Math.abs(totalInputY)) {
          totalInputY = yAxis;
        }
        if (Math.abs(xAxis) > 0.5 && Math.abs(xAxis) > Math.abs(totalInputX)) {
          totalInputX = xAxis;
        }
      }
      
      // Check X/Y buttons on left controller
      const xButton = gamepad['x-button'];
      const yButton = gamepad['y-button'];
      
      if (xButton?.state === 'pressed' || yButton?.state === 'pressed') {
        settingsPressed = true;
      }
    }
    
    const now = Date.now();
    
    // VIEWER MODE: Handle navigation and exit
    if (isViewerMode) {
      // B button to exit viewer
      if (bButtonPressed && onCloseViewer) {
        if (now - lastExitTime.current > 500) {
          lastExitTime.current = now;
          onCloseViewer();
          console.log('[XRScrollController] B button pressed - exiting viewer');
        }
      }
      
      // Thumbstick left/right to navigate photos
      if (Math.abs(totalInputX) > 0.5) {
        if (now - lastNavTime.current > 400) {
          lastNavTime.current = now;
          if (totalInputX > 0 && onNextPhoto) {
            onNextPhoto();
            console.log('[XRScrollController] Navigate next photo');
          } else if (totalInputX < 0 && onPrevPhoto) {
            onPrevPhoto();
            console.log('[XRScrollController] Navigate previous photo');
          }
        }
      }
      
      // Don't process scrolling in viewer mode
      return;
    }
    
    // GRID MODE: Apply scrolling with smoothing
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
      if (now - lastToggleTime.current > 500) {
        lastToggleTime.current = now;
        setSettingsOpen(prev => !prev);
        console.log('[XRScrollController] Settings toggled!');
      }
    }
  });

  return null;
}

export default XRScrollController;
