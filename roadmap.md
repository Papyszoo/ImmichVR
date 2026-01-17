# ImmichVR Master Roadmap

🧹 Phase 2: VR Core Cleanup (Immediate)

Goal: Remove legacy 2D debris and ensure a unified VR-first experience.
2.1 VR Usability Assessment

    Evaluate current 3D UI interaction models (raycasting vs direct touch).

    Identify friction points in photo navigation and setting adjustments.

2.2 Legacy Removal

    Remove SettingsModal: Legacy DOM-based overlay.

    Clean Routes: Remove unused 2D gallery routes (TimelineGallery, etc).

    Enforce Canvas: Ensure all new UI components use @react-three/uikit.

✨ Phase 3: Gaussian Splatting Support (High Priority)

Goal: Add photorealistic 3D viewing. Depends on Phase 1 architecture.
3.1 Model Strategy

Selected Solution: Apple ml-sharp Reasoning: Best balance of sub-second generation speed and photorealistic quality. Outputting standard .ply makes it compatible with web viewers.
Model	Speed	Quality	Pros	Cons
Apple ml-sharp	<1s	High	Ultra-fast, sharp geometry, metric scale.	Requires specific torch/cuda setup.
Splatter Image	~38 FPS	Medium	Extremely fast, single-pass.	Limited to frontal view (frustum).
LGM	Slow	High	Good geometry.	Heavy, multi-stage pipeline.
3.2 Backend Implementation

    Training Endpoint: POST /api/photos/:id/splat

        Triggers worker job processSplatJob.

        Saves output as .ply in generated_assets_3d.

    Conversion Endpoint: POST /api/photos/:id/splat/convert

        Converts .ply → .splat or .ksplat.

        Saves as new row in generated_assets_3d (same model_key, different format).

    Storage Structure:

    /immich-data/
      splats/
        {photo_id}_{model_key}.ply    # Raw
        {photo_id}_{model_key}.splat  # Web-ready

3.3 Frontend Implementation

    Viewer Integration:

        Library: @mkkellogg/gaussian-splats-3d.

        Component: GaussianSplatViewer (wraps library in React Three Fiber).

    Display Logic (Progressive Loading):
    
    graph LR
    A[Load Photo] --> B{Check Assets}
    B -- Has Splat --> C[Render Gaussian Splat]
    B -- Has Depth --> D[Render Parallax Depth]
    B -- None --> E[Render Flat Photo]

3.4 Settings & UI

    Quality Toggles: Light (~5MB) vs Full (~30MB) training configs.

    Badge System: Add [3D] (Splat) and [D] (Depth) badges to thumbnails using the new unified asset data.

🎥 Phase 4: Video Depth (Medium Priority)

Goal: True temporal consistency for video playback using Video Depth Anything.
4.1 Implementation Plan

    Pipeline: Replace current frame-by-frame approach with temporal batch processing.

    UI: Add video player controls in VR (Play/Pause/Scrub).

    Storage: Store depth video side-by-side with original video.

🔮 Phase 5: Future Features (Post-MVP)
5.1 Content Discovery

    Album Support: Browser view and navigation.

    People View: Face recognition integration.

    Search: Voice/Text search in VR.

5.2 Memories

    "On this day" presentation mode.

📝 Technical Reference
Dependencies
JSON

{
  "@react-three/uikit": "^0.x.x",
  "@mkkellogg/gaussian-splats-3d": "^0.4.x",
  "@react-spring/three": "^9.x.x"
}

Configuration (New src/config/vrGallery.js)
JavaScript

export const VR_GALLERY_CONFIG = {
  // Viewer
  adjacentPhotosCount: 2,
  animationDuration: 0.5,
  
  // Gaussian Splats
  gaussianSplat: {
    enabled: true,
    defaultQuality: 'medium',
    formats: ['splat', 'ksplat'] // Preferred formats
  },

  // Parallax
  parallaxIntensity: 0.1,
  
  // Gallery
  thumbnailSize: 1.0,
  rowWidth: 8,
  backgroundColor: '#000000',
};