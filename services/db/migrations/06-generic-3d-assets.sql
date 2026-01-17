-- ImmichVR Database Migration: Generic 3D Assets Schema
-- Replaces depth_map_cache with format-agnostic generated_assets_3d table
-- Supports multiple asset types (depth, splat, mesh) and formats

-- ============================================================================
-- 1. DROP OLD DEPTH-SPECIFIC SCHEMA
-- ============================================================================

-- Drop old table and dependent objects
DROP TABLE IF EXISTS depth_map_cache CASCADE;
DROP TYPE IF EXISTS depth_map_format CASCADE;
DROP TYPE IF EXISTS depth_map_version CASCADE;

-- ============================================================================
-- 2. CREATE GENERIC 3D ASSETS TABLE
-- ============================================================================

-- Generic 3D assets table
-- Stores ONE asset per (media_item_id, asset_type, model_key, format) combination
CREATE TABLE generated_assets_3d (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Reference to media item
    media_item_id UUID NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
    
    -- Asset classification
    asset_type VARCHAR(20) NOT NULL,      -- 'depth', 'splat', 'mesh'
    model_key VARCHAR(50),                 -- 'small', 'large', 'gs-fast', etc.
    format VARCHAR(20) NOT NULL,           -- 'jpg', 'ply', 'splat', 'ksplat'
    
    -- File information
    file_path TEXT NOT NULL,
    file_size BIGINT,
    
    -- Dimensions (for images/depth maps)
    width INTEGER,
    height INTEGER,
    
    -- Flexible metadata storage (point count for splats, etc.)
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraint: Unique combination of Photo + Type + Model + Format
    -- NULLS NOT DISTINCT ensures NULL model_keys are treated as equal
    CONSTRAINT unique_asset_version 
        UNIQUE NULLS NOT DISTINCT (media_item_id, asset_type, model_key, format)
);

-- Indexes for efficient lookups
CREATE INDEX idx_generated_assets_3d_media_item_id 
    ON generated_assets_3d(media_item_id);

CREATE INDEX idx_generated_assets_3d_asset_type 
    ON generated_assets_3d(asset_type);

CREATE INDEX idx_generated_assets_3d_model_key 
    ON generated_assets_3d(model_key);

CREATE INDEX idx_generated_assets_3d_generated_at 
    ON generated_assets_3d(generated_at);

-- Composite index for common query pattern
CREATE INDEX idx_generated_assets_3d_media_type_model 
    ON generated_assets_3d(media_item_id, asset_type, model_key);

-- ============================================================================
-- 3. UPDATE AI_MODELS TABLE
-- ============================================================================

-- Add type column to support different model categories
ALTER TABLE ai_models 
ADD COLUMN IF NOT EXISTS type VARCHAR(20) NOT NULL DEFAULT 'depth';

-- Rename columns for consistency with roadmap
ALTER TABLE ai_models 
RENAME COLUMN params TO params_size;

ALTER TABLE ai_models 
RENAME COLUMN memory TO vram_usage;

-- Add description if it doesn't exist (from migration 05)
ALTER TABLE ai_models 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Update existing models to have type 'depth'
UPDATE ai_models SET type = 'depth' WHERE type IS NULL;

-- ============================================================================
-- 4. CREATE TRIGGER FOR UPDATED_AT
-- ============================================================================

CREATE TRIGGER update_generated_assets_3d_updated_at
    BEFORE UPDATE ON generated_assets_3d
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. UPDATE VIEWS
-- ============================================================================

-- Drop old view that references depth_map_cache
DROP VIEW IF EXISTS media_processing_status CASCADE;

-- Recreate view with new table
CREATE VIEW media_processing_status AS
SELECT 
    m.id AS media_id,
    m.original_filename,
    m.media_type,
    m.uploaded_at,
    pq.status AS processing_status,
    pq.attempts AS processing_attempts,
    pq.last_error,
    ga.id AS asset_id,
    ga.asset_type,
    ga.model_key,
    ga.format,
    ga.file_path AS asset_path,
    ga.generated_at AS asset_generated_at
FROM media_items m
LEFT JOIN processing_queue pq ON m.id = pq.media_item_id
LEFT JOIN generated_assets_3d ga ON m.id = ga.media_item_id;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE generated_assets_3d IS 
    'Stores generated 3D assets (depth maps, gaussian splats, meshes) with support for multiple formats per model';

COMMENT ON COLUMN generated_assets_3d.asset_type IS 
    'Type of 3D asset: depth, splat, mesh';

COMMENT ON COLUMN generated_assets_3d.model_key IS 
    'Model identifier used to generate this asset (e.g., small, large, gs-fast)';

COMMENT ON COLUMN generated_assets_3d.format IS 
    'File format: jpg (depth), ply (raw splat), splat (web-optimized), ksplat (compressed)';

COMMENT ON COLUMN generated_assets_3d.metadata IS 
    'Flexible JSON storage for asset-specific properties (e.g., point_count for splats)';

COMMENT ON COLUMN ai_models.type IS 
    'Model category: depth (depth estimation) or splat (gaussian splatting)';

COMMENT ON COLUMN ai_models.params_size IS 
    'Model parameter count (e.g., 25M, 335M, 3GB)';

COMMENT ON COLUMN ai_models.vram_usage IS 
    'Estimated VRAM usage during inference (e.g., 100MB, 1.3GB, 4GB)';
