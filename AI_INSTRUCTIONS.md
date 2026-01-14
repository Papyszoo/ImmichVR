# AI Agent Instructions for ImmichVR

## Environment Setup
- **Start Project**: Run `docker-compose up -d` in the root directory.
- **Frontend URL**: https://localhost:21370 (HTTPS is required for VR/XR features).
- **Backend URL**: Backend is not accessible.

## Key Project Information
- **Type**: VR Frontend for Immich using WebXR.
- **Tech Stack**: React, Three.js, @react-three/fiber, @react-three/uikit.
- **Critical Note**: Always use `https://localhost:21370` for browser testing. HTTP will not work for XR sessions.

## Debugging
- If "Close" button or UI elements are missing in VR panel, check specifically for `uikit` compatibility (e.g., Fragments are not supported as direct children of Root/Container).
