-- ImmichVR Database Migration: Multi-Model Support
-- Allows multiple depth maps per photo (one per model variant)
-- Adds model download tracking and user settings

-- ============================================================================
-- 1. MODIFY DEPTH_MAP_CACHE FOR MULTI-MODEL SUPPORT
-- ============================================================================

-- Add model_key column to track which model generated each depth map
ALTER TABLE depth_map_cache 
ADD COLUMN IF NOT EXISTS model_key VARCHAR(50) DEFAULT 'large';

-- Drop old unique constraint (was: media_item_id + version_type)
ALTER TABLE depth_map_cache 
DROP CONSTRAINT IF EXISTS depth_map_cache_media_item_version_unique;

-- New unique constraint: one file per media+version+model combo
ALTER TABLE depth_map_cache 
ADD CONSTRAINT depth_map_cache_media_version_model_unique 
UNIQUE (media_item_id, version_type, model_key);

-- Index for fast lookup by model
CREATE INDEX IF NOT EXISTS idx_depth_map_cache_model_key 
ON depth_map_cache(model_key);

-- ============================================================================
-- 2. AI MODELS TRACKING TABLE
-- ============================================================================

-- Track downloaded AI models
CREATE TABLE IF NOT EXISTS ai_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Model identifier (small, base, large)
    model_key VARCHAR(50) NOT NULL UNIQUE,
    
    -- Download status: not_downloaded, downloading, downloaded, error
    status VARCHAR(20) NOT NULL DEFAULT 'not_downloaded',
    
    -- Download progress (0-100)
    download_progress INTEGER DEFAULT 0,
    
    -- Model file size in bytes
    file_size_bytes BIGINT,
    
    -- Timestamps
    downloaded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create trigger for updated_at
CREATE TRIGGER update_ai_models_updated_at
    BEFORE UPDATE ON ai_models
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default model entries
INSERT INTO ai_models (model_key, status) VALUES 
('small', 'downloaded'),  -- Default in development
('base', 'not_downloaded'),
('large', 'not_downloaded')
ON CONFLICT (model_key) DO NOTHING;

-- ============================================================================
-- 3. USER SETTINGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Optional user reference (NULL = global/default settings)
    user_id UUID,
    
    -- Depth model settings
    default_depth_model VARCHAR(50) NOT NULL DEFAULT 'small',
    auto_generate_on_enter BOOLEAN NOT NULL DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- One settings row per user (or one global row with NULL user_id)
    CONSTRAINT user_settings_user_unique UNIQUE (user_id)
);

-- Create trigger for updated_at
CREATE TRIGGER update_user_settings_updated_at
    BEFORE UPDATE ON user_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default global settings
INSERT INTO user_settings (user_id, default_depth_model, auto_generate_on_enter) 
VALUES (NULL, 'small', false)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- 4. UPDATE VIEWS
-- ============================================================================

-- Drop and recreate media_processing_status view to include model info
DROP VIEW IF EXISTS media_processing_status;

CREATE VIEW media_processing_status AS
SELECT 
    m.id AS media_id,
    m.original_filename,
    m.media_type,
    m.uploaded_at,
    pq.status AS processing_status,
    pq.attempts AS processing_attempts,
    pq.last_error,
    dc.id AS depth_map_id,
    dc.file_path AS depth_map_path,
    dc.model_key AS depth_model,
    dc.generated_at AS depth_map_generated_at
FROM media_items m
LEFT JOIN processing_queue pq ON m.id = pq.media_item_id
LEFT JOIN depth_map_cache dc ON m.id = dc.media_item_id;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE ai_models IS 'Tracks AI model download status for depth generation';
COMMENT ON COLUMN ai_models.model_key IS 'Model identifier: small, base, or large';
COMMENT ON COLUMN ai_models.status IS 'Download status: not_downloaded, downloading, downloaded, error';

COMMENT ON TABLE user_settings IS 'User preferences for depth generation';
COMMENT ON COLUMN user_settings.default_depth_model IS 'Default model for auto-generation';
COMMENT ON COLUMN user_settings.auto_generate_on_enter IS 'Auto-generate depth when viewing a photo';

COMMENT ON COLUMN depth_map_cache.model_key IS 'Model used to generate this depth map (small, base, large)';
