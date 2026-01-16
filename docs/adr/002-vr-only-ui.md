# ADR 002: VR First and VR Only UI

## Status
Accepted

## Context
ImmichVR is designed specifically as a Virtual Reality client for Immich. WebXR applications present unique challenges regarding User Interface (UI). Standard HTML/DOM elements (divs, buttons) overlaying the canvas are **not visible** within an immersive VR session.

## Decision
We enforce a **"VR First & VR Only"** policy for all User Interfaces.

1.  **No DOM Overlays**: We explicitly ban the usage of HTML DOM elements for the application UI. If a control is needed, it must be rendered within the 3D scene (using `@react-three/uikit`, `@react-three/drei`, or raw meshes).
2.  **No 2D Fallbacks**: We will not build "desktop" versions of VR features. If a feature cannot be used in a headset, it should not exist in this application. Users desiring a 2D experience should use the standard Immich web interface.
3.  **Input Methods**: The primary input methods are XR Controllers (Thumbsticks, Triggers, Grip). Mouse/Keyboard interactions are deprecated for end-users and only tolerated for emulator/debugging purposes.

## Consequences
*   **Development Complexity**: Building UI in 3D is harder than standard HTML/CSS. Developers must use R3F libraries effectively.
*   **Immersion**: The user experience is 100% immersive with no context switching between VR and flat modes.
*   **Scope Constraint**: This prevents "scope creep" where the app slowly turns into a generic 3D web viewer instead of a dedicated VR app.
