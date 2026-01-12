# Testing VR with Immersive Web Emulator (Meta)

This project uses the standard WebXR API. For desktop testing, we use the **Immersive Web Emulator** (by Meta), which provides a visual interface to simulate a Quest headset and controllers.

> [!NOTE]
> The older **WebXR API Emulator** (Mozilla) also works but has a different interface. This guide focuses on the Meta Immersive Web Emulator.

---

## 1. Setup

### Install the Extension(s)

| Extension | Link |
|---|---|
| **Immersive Web Emulator** (Recommended) | [Chrome Web Store](https://chromewebstore.google.com/detail/immersive-web-emulator/cgffilbpcibhmcfbgggfhfolhkfbhmik) |
| **WebXR API Emulator** (Mozilla, Alternative) | [Chrome Web Store](https://chrome.google.com/webstore/detail/webxr-api-emulator/mjddjgeghkdijejnciaefnkjmkafnnje) |

### Configure the Emulator

1. Click the extension icon in Chrome toolbar
2. Select device (e.g., **Meta Quest 3**)
3. The emulator is now active for WebXR pages

---

## 2. Emulator UI Overview

When you enter VR mode, the Immersive Web Emulator displays:

```
┌─────────────────────────────────────────────────────────────────┐
│ [Meta Quest 3 ▾]  [Headset] [Left] [Right] [Settings] [Exit VR] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│    LEFT                     3D VIEWPORT                   RIGHT │
│  CONTROLLER                                             CONTROLLER
│    PANEL                    (Gallery renders here)        PANEL │
│                                                                 │
│  ┌─────────┐               ┌────────────────────┐     ┌─────────┐
│  │Position │               │  Controller 3D     │     │Position │
│  │ X Y Z   │               │  Models with Rays  │     │ X Y Z   │
│  │Rotation │               │                    │     │Rotation │
│  │ X Y Z   │               │       ──────>      │     │ X Y Z   │
│  ├─────────┤               │  (visible ray/     │     ├─────────┤
│  │ Buttons │               │   pointer line)    │     │ Buttons │
│  │ LT  LG  │               │                    │     │ RT  RG  │
│  │ X   Y   │               └────────────────────┘     │ A   B   │
│  │Thumbstck│                                           │Thumbstck│
│  └─────────┘                                           └─────────┘
└─────────────────────────────────────────────────────────────────┘
```

### Key UI Elements:

- **Position/Rotation Inputs**: Type numeric values directly (e.g., `0.2` for X position)
- **3D Gizmos**: Drag colored arrows (position) or arcs (rotation) on controller models
- **Button Rows**: Click **"Press"** to simulate button presses
- **Thumbstick Circle**: Click and drag to simulate analog stick movement

---

## 3. Pointing & Selection (Controller Ray)

### How the Ray Works

Both controllers emit a **white ray/line** from the controller model. This ray is used for:
- Pointing at UI elements and photos
- Determining which object is "hovered" or will be selected

### How to Aim the Controller

**Method 1: Numeric Input**
1. In the controller panel, find **Rotation** fields
2. Adjust **X** (pitch up/down) to aim the ray at photos
3. Typical useful values: `X: 15-30` to point at the gallery wall

**Method 2: 3D Gizmo Dragging**
1. Click and drag the **colored arcs** on the 3D controller model
2. Red arc = pitch (up/down)
3. The ray updates in real-time as you rotate

### Hover Feedback

- When the ray points at a photo, the photo shows a **white border glow**
- The `VRPhoto` component handles `onPointerEnter`/`onPointerLeave` events

---

## 4. Controller Button Mapping

### Right Controller

| Button | Emulator Label | Grid Mode Action | Viewer Mode Action |
|--------|---------------|------------------|-------------------|
| **Trigger (RT)** | `RT` → Press | **Select photo** (opens viewer) | **Select adjacent photo** |
| **A Button** | `A` → Press | Toggle Settings panel | - |
| **B Button** | `B` → Press | - | **Exit viewer** (back to grid) |
| **Thumbstick Y** | Drag circle up/down | **Scroll gallery** | - |
| **Thumbstick X** | Drag circle left/right | - | **Navigate prev/next photo** |
| **Thumbstick Click** | `Thumbstick` → Press | Toggle Settings | - |
| **Grip (RG)** | `RG` → Press | (not used currently) | (not used currently) |

### Left Controller

| Button | Emulator Label | Grid Mode Action | Viewer Mode Action |
|--------|---------------|------------------|-------------------|
| **Trigger (LT)** | `LT` → Press | **Select photo** | **Select adjacent photo** |
| **X Button** | `X` → Press | Toggle Settings panel | - |
| **Y Button** | `Y` → Press | Toggle Settings panel | - |
| **Thumbstick Y** | Drag circle up/down | **Scroll gallery** (if right not used) | - |
| **Thumbstick X** | Drag circle left/right | - | **Navigate prev/next photo** |
| **Grip (LG)** | `LG` → Press | (not used currently) | (not used currently) |

---

## 5. Common Testing Workflows

### Testing Gallery Scrolling

1. Enter VR mode
2. Find the **Right Controller** panel (right side of screen)
3. Locate the **thumbstick circle** (circular gizmo)
4. **Click and drag down** inside the circle to scroll down
5. The gallery should scroll, loading more photos as you go

> [!TIP]
> The scroll sensitivity requires `|yAxis| > 0.15` to trigger. Make sure to drag far enough.

### Testing Photo Selection

1. Enter VR mode
2. **Aim the controller ray** at a photo:
   - Adjust Right Controller **Rotation X** to ~20-30
   - Optionally adjust **Position** to move controller closer
3. Look for the **white hover glow** on a photo
4. Click **"Press"** next to **RT** (Right Trigger)
5. The photo should animate to center view

### Testing Viewer Navigation

Once a photo is selected:
1. **Drag thumbstick left/right** to navigate between photos
2. Click **"Press"** next to **B** button to exit viewer

---

## 6. Code Reference - Where Controls Are Implemented

| Feature | File | Key Code |
|---------|------|----------|
| Thumbstick scrolling | `XRScrollController.jsx` | `gamepad['xr-standard-thumbstick'].yAxis` |
| Photo navigation | `XRScrollController.jsx` | `totalInputX > 0.5` → `onNextPhoto()` |
| Exit viewer (B button) | `XRScrollController.jsx` | `gamepad['b-button'].state === 'pressed'` |
| Settings toggle (A/X/Y) | `XRScrollController.jsx` | `aButton/xButton/yButton.state === 'pressed'` |
| Photo hover effect | `VRPhoto.jsx` | `onPointerEnter` → `setHovered(true)` |
| Photo click/select | `VRPhoto.jsx` | `onClick={handleClick}` → `onSelect(photo)` |

### The `gamepad` Object Structure

```javascript
// Accessed via: rightController.gamepad
{
  'xr-standard-thumbstick': {
    xAxis: -1.0 to 1.0,  // Left/Right
    yAxis: -1.0 to 1.0,  // Up/Down (inverted: down = positive)
    state: 'pressed' | 'default' | 'touched'
  },
  'xr-standard-trigger': {
    state: 'pressed' | 'default'
  },
  'a-button': { state: 'pressed' | 'default' },
  'b-button': { state: 'pressed' | 'default' },
  'x-button': { state: 'pressed' | 'default' },  // Left controller
  'y-button': { state: 'pressed' | 'default' },  // Left controller
  'xr-standard-squeeze': { state: 'pressed' | 'default' }  // Grip
}
```

---

## 7. Troubleshooting

### "Enter VR" button not visible

- Ensure HTTPS (or localhost)
- Check extension is enabled
- Try refreshing the page after enabling

### Scrolling not working

1. Verify you're dragging the **thumbstick circle**, not the controller itself
2. Make sure drag distance is substantial (needs `|y| > 0.15`)
3. Check console for `[XRScrollController] Controllers detected!`

### Photo selection not working

1. Ensure ray is **actually pointing at a photo**:
   - Adjust Rotation X to aim downward
   - Move controller closer with Position adjustments
2. Look for **hover glow** before clicking trigger
3. Check console for click events

### Controllers not detected

Check browser console for:
```
[XRScrollController] Controllers detected!
  Left: connected
  Right: connected
```

If not shown, controllers aren't being recognized. Try:
- Toggling VR session off/on
- Refreshing page
- Checking extension settings

---

## 8. Alternative: WebXR API Emulator (Mozilla)

If using the Mozilla extension instead:
- Opens in **DevTools** → **WebXR** tab (not screen overlay)
- Similar controls but different UI layout
- Some button labels may differ

---

## 9. Quick Reference Card

```
┌──────────────────────────────────────────────────────────────┐
│                     ImmichVR Controls                        │
├──────────────────────────────────────────────────────────────┤
│ GRID MODE:                                                   │
│   • Thumbstick Up/Down → Scroll gallery                      │
│   • Point + Trigger   → Select photo (enter viewer)          │
│   • A/X/Y Button      → Toggle settings                      │
├──────────────────────────────────────────────────────────────┤
│ VIEWER MODE:                                                 │
│   • Thumbstick Left/Right → Navigate prev/next photo         │
│   • Point + Trigger       → Select adjacent photo            │
│   • B Button              → Exit to grid                     │
└──────────────────────────────────────────────────────────────┘
```
