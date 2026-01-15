# VR Agent Instructions & Development Principles

This document serves as the primary source of truth for all future development on ImmichVR.

## Core Principle: VR First & VR Only
ImmichVR is strictly a Virtual Reality application. Its core value proposition is the immersive experience. 
**We assume the user is wearing a Head-Mounted Display (HMD) at all times.**

## Strict Rules

1.  **No DOM-based UI**
    *   **Prohibited**: `<div>`, `<button>`, `ControlOverlay`, `SettingsModal`, or any HTML elements overlaying the canvas.
    *   **Reason**: DOM elements are not visible in WebXR immersive sessions.
    *   **Requirement**: All UI **MUST** be rendered within the Three.js canvas using `@react-three/uikit`, `@react-three/drei`, or raw R3F meshes.

2.  **No 2D Fallbacks**
    *   Do not build "desktop" versions of VR features.
    *   If a feature cannot be used in VR, it should not exist in this application.
    *   Users desiring a 2D experience should use the standard Immich web interface.

3.  **Input Handling**
    *   **Primary**: XR Controllers (Thumbsticks, Triggers, Grip).
    *   **Secondary**: Hand Tracking (future proofing).
    *   **Deprecated**: Mouse/Keyboard clicks on screen overlay (except for debug/emulator use).

## Testing Strategy
*   **Unit/Integration**: Test logic independent of the view layer.
*   **E2E (Playwright)**:
    *   Do **NOT** rely on standard DOM selectors (`page.click('button')`) for app interaction.
    *   **Use the Bridge Pattern**: Expose internal 3D state/actions via `window.__VR_UI_INTERNALS`.
    *   Tests must drive the app by invoking these exposed actions to simulate VR controller inputs or logic triggers.
    *   Verify results by checking state changes in the exposed internal store or via visual regression (screenshots of the canvas).

## Refactoring Mandate
*   Any existing DOM code is considered "Legacy" and must be removed.
*   All new features must be implemented directly in the 3D scene.
