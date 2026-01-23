import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useXRInputSourceState } from '@react-three/xr';
import { Vector3, Quaternion, Matrix4 } from 'three';

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
  onCloseViewer,
  onTransform, // New prop for scene manipulation
  onTogglePerformanceMonitor, // Toggle PerformanceMonitor visibility with L3
  onResetSplat // Reset Splat transform with R3
}) {
  const { gl } = useThree();
  
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
  const lastPerfToggleTime = useRef(0); // Debounce for L3 button (Performance Monitor)
  const lastResetTime = useRef(0); // Debounce for R3 button (Reset Splat)
  
  // --- GRAB / MANIPULATION STATE ---
  const isGrippingLeft = useRef(false);
  const isGrippingRight = useRef(false);
  const previousLeftPos = useRef(new Vector3());
  const previousRightPos = useRef(new Vector3());
  
  // For scaling: distance between controllers
  const initialGrabDistance = useRef(0);
  


  useFrame((state, delta, frame) => {
    // Get current time for debouncing - MUST be at top for all controller logic
    const now = Date.now();

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
         // A button (4) for settings
         if (buttons[4]?.pressed) {
           settingsPressed = true;
         }
         
         // R3 (Right Thumbstick Click) - Reset Splat
         if (buttons[3]?.pressed && onResetSplat) {
             if (now - lastResetTime.current > 500) {
                 lastResetTime.current = now;
                 onResetSplat();
                 console.log('[XRScrollController] R3 pressed - reset splat');
             }
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
        
        // L3 button (left thumbstick click) to toggle PerformanceMonitor
        if (buttons[3]?.pressed && onTogglePerformanceMonitor) {
          if (now - lastPerfToggleTime.current > 500) {
            lastPerfToggleTime.current = now;
            onTogglePerformanceMonitor();
            console.log('[XRScrollController] L3 pressed - toggling PerformanceMonitor');
          }
        }
      }
    }
    
    
    // --- MANIPULATION LOGIC (Viewer Mode Only) ---
    if (isViewerMode && onTransform && frame) {
        const referenceSpace = gl.xr.getReferenceSpace();
        if (referenceSpace) {
            // Get Controller Poses
            const leftInput = leftController?.inputSource;
            const rightInput = rightController?.inputSource;
            
            let leftPose = null;
            let rightPose = null;
            
            if (leftInput && leftInput.gripSpace) {
                leftPose = frame.getPose(leftInput.gripSpace, referenceSpace);
            }
            if (rightInput && rightInput.gripSpace) {
                rightPose = frame.getPose(rightInput.gripSpace, referenceSpace);
            }

            // Check Grip Buttons (Squeeze)
            // Squeeze is often mapped to buttons[1] or specific squeeze input
            // But gamepads usually have it as button 1 (Grip)
            // Let's check typical mappings. 
            // Oculus Touch: 1 = Grip.
            let leftGripPressed = false;
            let rightGripPressed = false;

            if (leftGamepad?.buttons && leftGamepad.buttons[1]) leftGripPressed = leftGamepad.buttons[1].pressed;
            if (rightGamepad?.buttons && rightGamepad.buttons[1]) rightGripPressed = rightGamepad.buttons[1].pressed;

            // --- STATE TRANSITIONS & EVENT RESET ---
            
            // If just started gripping left, capture position
            if (leftGripPressed && !isGrippingLeft.current && leftPose) {
                previousLeftPos.current.copy(leftPose.transform.position);
            }
            
            // If just started gripping right, capture position for scale/steering
            if (rightGripPressed && !isGrippingRight.current && rightPose) {
                previousRightPos.current.copy(rightPose.transform.position); 
            }
            
            // Update flags
            isGrippingLeft.current = leftGripPressed;
            isGrippingRight.current = rightGripPressed;

            // --- APPLY TRANSFORMS ---
            
            if (leftPose && rightPose) {
                const leftPos = new Vector3().copy(leftPose.transform.position);
                const rightPos = new Vector3().copy(rightPose.transform.position);
                const rightRot = new Quaternion().copy(rightPose.transform.orientation);

                // 1. DUAL HAND MANIPULATION (Scale + Rotation)
                if (leftGripPressed && rightGripPressed) {
                    // --- SCALE (Pinch distance) ---
                    const currentDist = leftPos.distanceTo(rightPos);
                    const prevDist = previousLeftPos.current.distanceTo(previousRightPos.current);
                    
                    if (prevDist > 0.001) {
                        const scaleFactor = currentDist / prevDist;
                        onTransform({ scaleFactor });
                    }
                    
                    // --- ROTATION (Steering Wheel / Handlebar) ---
                    // 1. Y-Axis (Yaw) - Angle in X-Z plane
                    const dx = rightPos.x - leftPos.x;
                    const dz = rightPos.z - leftPos.z;
                    const currentYaw = Math.atan2(dz, dx);
                    
                    const prevDx = previousRightPos.current.x - previousLeftPos.current.x;
                    const prevDz = previousRightPos.current.z - previousLeftPos.current.z;
                    const prevYaw = Math.atan2(prevDz, prevDx);
                    
                    let deltaYaw = currentYaw - prevYaw;
                    if (deltaYaw > Math.PI) deltaYaw -= Math.PI * 2;
                    if (deltaYaw < -Math.PI) deltaYaw += Math.PI * 2;

                    // 2. Z-Axis (Roll) - Angle in X-Y plane
                    const dy = rightPos.y - leftPos.y;
                    const currentRoll = Math.atan2(dy, dx);
                    
                    const prevDy = previousRightPos.current.y - previousLeftPos.current.y;
                    const prevRoll = Math.atan2(prevDy, prevDx);
                    
                    let deltaRoll = currentRoll - prevRoll;
                    if (deltaRoll > Math.PI) deltaRoll -= Math.PI * 2;
                    if (deltaRoll < -Math.PI) deltaRoll += Math.PI * 2;
                    
                    // Apply Rotations
                    const rotDelta = new Quaternion();
                    let hasRotation = false;

                    if (Math.abs(deltaYaw) > 0.0001) {
                         // Rotate around Y axis
                         rotDelta.multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -deltaYaw));
                         hasRotation = true;
                    }
                    if (Math.abs(deltaRoll) > 0.0001) {
                         // Rotate around Z axis (Roll)
                         // Check sign: if right hand goes UP (positive dy), angle increases (positive).
                         // We likely want object to roll left/right with hands.
                         rotDelta.multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), deltaRoll));
                         hasRotation = true;
                    }

                    if (hasRotation) {
                         onTransform({ rotationDelta: rotDelta });
                    }
                    
                    // Reset anchors for next frame
                    previousLeftPos.current.copy(leftPos);
                    previousRightPos.current.copy(rightPos);
                    
                } 
                // 2. MOVE (Left Grip Only)
                else if (leftGripPressed) {
                    const delta = new Vector3().subVectors(leftPos, previousLeftPos.current);
                    
                    // Apply translation with speed factor (2.5x faster)
                    delta.multiplyScalar(2.5);
                    
                    onTransform({ positionDelta: delta });
                    
                    previousLeftPos.current.copy(leftPos);
                }
                // 3. RIGHT GRIP ONLY (Move)
                else if (rightGripPressed) {
                     const delta = new Vector3().subVectors(rightPos, previousRightPos.current);
                     
                     // Apply translation with speed factor (2.5x faster)
                     delta.multiplyScalar(2.5);
                     
                     onTransform({ positionDelta: delta });
                     
                     previousRightPos.current.copy(rightPos);
                }
            }
        }
    }

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
