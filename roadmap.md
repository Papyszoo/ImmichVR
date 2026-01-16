# ImmichVR Master Roadmap

**Status:** Active Development
**Focus:** 3D Pipeline Refactoring, VR UI Consolidation, Gaussian Splats

---

## 🚨 Phase 1: Architecture Refactoring (Immediate)
**Goal:** Replace the fragile "Depth Model" logic with a generic "3D Asset" pipeline that supports Depth, Splats, and future formats natively.

### 1.1 Database Schema ("Clean Slate")
*Action: Drop existing `depth_map_cache` and recreate the schema to be format-agnostic.*

**New Schema Definition:**
```sql
-- 1. Generic 3D Assets Table
-- Replaces 'depth_map_cache'. Stores ONE asset per type+model+format combination.
CREATE TABLE generated_assets_3d (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    media_item_id UUID NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
    
    -- Broad category: "depth", "splat", "mesh"
    asset_type VARCHAR(20) NOT NULL,
    
    -- Specific Model/Method: "small", "large", "gs-standard", "gs-fast"
    -- Nullable if the method doesn't have variants.
    model_key VARCHAR(50), 
    
    -- File Format: "jpg", "ply", "splat", "ksplat"
    -- Allows storing both the raw training output (ply) and web-optimized version (splat)
    format VARCHAR(20) NOT NULL,
    
    file_path TEXT NOT NULL,
    file_size BIGINT,
    
    -- Metadata (depth width/height, splat point count, etc.)
    width INTEGER,
    height INTEGER,
    metadata JSONB DEFAULT '{}', 
    
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraint: Unique combination of Photo + Type + Model + Format
    CONSTRAINT unique_asset_version UNIQUE NULLS NOT DISTINCT (media_item_id, asset_type, model_key, format)
);

-- 2. AI Models Table
-- Tracks installed weights/code for ANY type of generation
CREATE TABLE IF NOT EXISTS ai_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_key VARCHAR(50) NOT NULL UNIQUE,
    type VARCHAR(20) NOT NULL DEFAULT 'depth', -- 'depth' or 'splat'
    name VARCHAR(100),
    description TEXT,
    params_size VARCHAR(20), -- e.g. "25M", "3GB"
    vram_usage VARCHAR(20),  -- e.g. "100MB", "4GB"
    status VARCHAR(20) NOT NULL DEFAULT 'not_downloaded',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

1.2 Backend API Generalization

Goal: Decouple API routes from "depth" terminology.

    Update generated-files.routes.js:

        Change GET /api/photos/:id/files to return generic objects:
        JavaScript

        {
          id: "...",
          type: "splat",      // from asset_type
          format: "ply",      // from format
          modelKey: "gs-fast" // from model_key
        }

    Update API Gateway: Ensure deletion logic targets generated_assets_3d by ID, regardless of type.

1.3 Frontend Logic Extraction (The "View Model")

Goal: Remove all business logic from UI components. The UI should only know "View X is ready" or "View Y needs conversion".

New Hook: usePhoto3DManager.js

    Input: generatedFiles (DB), availableModels (Disk), systemModels (Definitions).

    Logic:

        Group files by modelKey.

        Determine status based on file existence AND format.

            Has .splat? -> Ready.

            Has .ply only? -> Can Convert.

            Has neither but model installed? -> Missing (Generate).

            Model not installed? -> Not Installed.

    Output: viewOptions array containing generic objects for the UI to render.

1.4 Component Cleanup

    Refactor Photo3DViewsPanel.jsx:

        Remove all internal state and logic.

        Accept viewOptions from the hook.

        Render generic rows: [Icon] [Label] [Action Button].

        Action Button triggers generic handler: onGenerate(type, model) or onConvert(model).

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
    Fragment kodu

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