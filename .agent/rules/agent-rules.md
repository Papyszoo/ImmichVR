---
trigger: always_on
---

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

## Model Management & Lifecycle (Backend Authority)
The backend is the sole source of truth for model state.
1.  **Download vs Load**:
    -   **Download**: Model files exist on disk (`/data/huggingface/...`). Use `check_downloaded` logic (disk check), never memory state.
    -   **Load**: Model is loaded into GPU/RAM for inference.
2.  **Lazy Loading**:
    -   Models are **NEVER** loaded at startup.
    -   Models are loaded **ONLY** when:
        -   User explicitly clicks "Activate".
        -   User enters a photo AND `autoGenerateOnEnter` is TRUE AND depth map is missing.
3.  **Timeouts (Sliding Window)**:
    -   **Auto-Trigger**: Unload after **30 minutes** of inactivity.
    -   **Manual-Trigger**: Unload after **10 minutes** of inactivity.
    -   **Activity**: Any usage (generation request) resets the timer. If trigger type changes (e.g., auto -> manual), the timeout window updates accordingly.
4.  **Extensibility**:
    -   Supported models are defined in the database (`ai_models` table), not hardcoded in code.

## Meta-Rules (Agent Behavior)
1.  **Preserve Context**: Important task context in this file must **NEVER** be deleted or lost during updates. Always Append or Refine, never just Replace with less detail.
2.  **Single Source of Truth**: This file determines the architectural and behavioral rules.
3.  **Don't Assume, Check**: Do not add features or fixes based on assumptions without checking the codebase or asking the user.
4.  **No Unrequested Features**: Stick strictly to the user's request. Do not implement "helpful" features that were not asked for.

# AI Agent Instructions for ImmichVR

## Environment Setup
- **Start Project**: Run `docker-compose up -d` in the root directory. If you want clean database remove data folder. If you want to rebuild use --build flag.
- **Frontend URL**: https://localhost:21370 (HTTPS is required for VR/XR features).
- **Backend URL**: Backend is not accessible.

## Key Project Information
- **Type**: VR Frontend for Immich using WebXR.
- **Tech Stack**: React, Three.js, @react-three/fiber, @react-three/uikit.
- **Critical Note**: Always use `https://localhost:21370` for browser testing. HTTP will not work for XR sessions.

## Debugging
- If "Close" button or UI elements are missing in VR panel, check specifically for `uikit` compatibility (e.g., Fragments are not supported as direct children of Root/Container).

# 🧠 MEMORY & ARCHITECTURE PROTOCOL (AUTO-ADR)

## The "Silent Scribe" Rule
You are responsible for maintaining the project's institutional memory.
**I will not write documentation. You will.**

Whenever a conversation results in a decision that affects:
1.  **Architecture** (e.g., "Split this service", "Use Nginx")
2.  **Constraints** (e.g., "Never load models on startup")
3.  **Dependencies** (e.g., "Switch to Vitest")

You MUST perform the following **"Memory Commit"** sequence automatically:

1.  **Check `docs/adr/`**: Does a record exist for this?
2.  **If NO**: Draft a new ADR file (e.g., `docs/adr/005-lazy-loading.md`).
3.  **If YES**: Update the existing ADR to reflect the new nuance.
4.  **Action**: Present the file content to me and ask: *"I have recorded this decision in [File Name]. Save it?"*

## The "Constitution" Check
Before writing any code, you must check the `docs/adr/` folder.
* If you are about to violate an ADR (e.g., activating a model when ADR-002 says "Stay Dormant"), **STOP**.
* Warn me: *"This request conflicts with ADR-002. Do you want to amend the ADR or change the request?"*