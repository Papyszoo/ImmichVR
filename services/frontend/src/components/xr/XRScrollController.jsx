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
  paused = false,
  onNextPhoto,
  onPrevPhoto,
  onCloseViewer
}) {
  // Use the official hook to get controller state
  // Use the official hook to get controller state - check both 'controller' and 'hand' (for SteamVR fallback)
  const leftControllerState = useXRInputSourceState('controller', 'left');
  const leftHandState = useXRInputSourceState('hand', 'left');
  const leftController = leftControllerState ?? leftHandState;

  const rightControllerState = useXRInputSourceState('controller', 'right');
  const rightHandState = useXRInputSourceState('hand', 'right');
  const rightController = rightControllerState ?? rightHandState;
  
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
      if (leftController) console.log('  Left keys:', Object.keys(leftController));
      if (rightController) console.log('  Right keys:', Object.keys(rightController));
      
      const rightGamepad = rightController?.inputSource?.gamepad;
      if (rightGamepad) {
        console.log('  Right gamepad keys:', Object.keys(rightGamepad)); // Should work now
      } else {
        console.log('  Right gamepad NOT found on inputSource');
      }
    }
    
    let totalInputY = 0;
    let totalInputX = 0;
    let settingsPressed = false;
    let bButtonPressed = false;
    
    // Process right controller (primary for scrolling)
    // Process right controller (primary for scrolling)
    const rightGamepad = rightController?.inputSource?.gamepad;
    
    if (rightGamepad) {
      // Standard WebXR Gamepad Mapping (Oculus Touch / Standard)
      // Axes: [0]=TouchpadX, [1]=TouchpadY, [2]=ThumbstickX, [3]=ThumbstickY
      // Note: Some checks needed as arrays might be shorter if no touchpad
      
      const axes = rightGamepad.axes;
      const buttons = rightGamepad.buttons;
      
      // Thumbstick is usually axes 2 and 3
      if (axes && axes.length >= 4) {
        const yAxis = axes[3]; // Up/Down
        const xAxis = axes[2]; // Left/Right
        
        if (Math.abs(yAxis) > 0.15) {
          totalInputY = yAxis;
        }
        if (Math.abs(xAxis) > 0.5) {
          totalInputX = xAxis;
        }
      }
      
      // Buttons
      // 3: Thumbstick Click
      // 4: A button
      // 5: B button
      if (buttons) {
         // B button (5) for exit viewer
         if (buttons[5]?.pressed) {
           bButtonPressed = true;
         }
         // A button (4) or Thumbstick Click (3) for settings
         if (buttons[4]?.pressed || buttons[3]?.pressed) {
           settingsPressed = true;
         }
      }
    }
    
    // Process left controller (secondary)
    const leftGamepad = leftController?.inputSource?.gamepad;
    
    if (leftGamepad) {
      const axes = leftGamepad.axes;
      const buttons = leftGamepad.buttons;
      
      if (axes && axes.length >= 4) {
         const yAxis = axes[3];
         const xAxis = axes[2];
         
         // Use left stick if right isn't providing input
         if (Math.abs(yAxis) > 0.15 && Math.abs(yAxis) > Math.abs(totalInputY)) {
           totalInputY = yAxis;
         }
         if (Math.abs(xAxis) > 0.5 && Math.abs(xAxis) > Math.abs(totalInputX)) {
           totalInputX = xAxis;
         }
      }
      
      // X/Y buttons on left controller are usually mapped same as A/B (4/5) relative to hand
      if (buttons) {
        if (buttons[4]?.pressed || buttons[5]?.pressed) { 
           settingsPressed = true;
        }
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
    if (!paused && Math.abs(totalInputY) > 0.1) {
      const smoothedInput = lastInputY.current * 0.3 + totalInputY * 0.7;
      lastInputY.current = smoothedInput;
      
      const acceleration = Math.pow(Math.abs(smoothedInput), 1.5);
      const scrollSpeed = 3.0 * delta * acceleration * Math.sign(smoothedInput);
      
      scrollAccumulator.current += scrollSpeed;
      
      if (Math.abs(scrollAccumulator.current) > 0.01) {
        setScrollY(prev => {
          // Stick UP (negative) should DECREASE scrollY (move up)
          // Stick DOWN (positive) should INCREASE scrollY (move down)
          const newY = prev + scrollAccumulator.current;
          return Math.max(0, Math.min(totalHeight, newY));
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
