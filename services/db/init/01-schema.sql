-- ImmichVR Database Schema
-- This schema supports metadata storage, processing queue tracking,
-- and caching paths for generated depth maps for both photos and videos.

-- Enable UUID extension for generating unique identifiers
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- MEDIA METADATA TABLES
-- ============================================================================

-- Media types enum
CREATE TYPE media_type AS ENUM ('photo', 'video');

-- Media items table (photos and videos)
CREATE TABLE media_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Media identification
    original_filename VARCHAR(512) NOT NULL,
    media_type media_type NOT NULL,
    
    -- File information
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(127) NOT NULL,
    
    -- Media dimensions and properties
    width INTEGER,
    height INTEGER,
    duration_seconds DECIMAL(10, 2), -- For videos only
    frame_rate DECIMAL(5, 2), -- For videos only
    
    -- Checksum for integrity verification
    checksum VARCHAR(64), -- SHA256 hash
    
    -- Metadata
    captured_at TIMESTAMP WITH TIME ZONE,
    uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- User/ownership information (extensible)
    user_id UUID, -- Can be linked to a users table in the future
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_media_items_media_type ON media_items(media_type);
CREATE INDEX idx_media_items_user_id ON media_items(user_id);
CREATE INDEX idx_media_items_uploaded_at ON media_items(uploaded_at);
CREATE INDEX idx_media_items_checksum ON media_items(checksum);

-- ============================================================================
-- PROCESSING QUEUE TABLES
-- ============================================================================

-- Processing status enum
CREATE TYPE processing_status AS ENUM (
    'pending',      -- Waiting to be processed
    'queued',       -- In the queue
    'processing',   -- Currently being processed
    'completed',    -- Successfully completed
    'failed',       -- Processing failed
    'cancelled'     -- Processing was cancelled
);

-- Processing queue table
CREATE TABLE processing_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Reference to media item
    media_item_id UUID NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
    
    -- Processing status
    status processing_status NOT NULL DEFAULT 'pending',
    
    -- Priority (lower number = higher priority)
    priority INTEGER NOT NULL DEFAULT 5,
    
    -- Processing metadata
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    
    -- Error tracking
    last_error TEXT,
    error_count INTEGER NOT NULL DEFAULT 0,
    
    -- Processing timestamps
    queued_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Processing time metrics
    processing_duration_seconds DECIMAL(10, 2),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queue management
CREATE INDEX idx_processing_queue_status ON processing_queue(status);
CREATE INDEX idx_processing_queue_media_item_id ON processing_queue(media_item_id);
CREATE INDEX idx_processing_queue_priority ON processing_queue(priority, queued_at);
CREATE INDEX idx_processing_queue_status_priority ON processing_queue(status, priority, queued_at);

-- ============================================================================
-- DEPTH MAP CACHE TABLES
-- ============================================================================

-- Depth map format enum
CREATE TYPE depth_map_format AS ENUM (
    'png',          -- PNG image format
    'exr',          -- OpenEXR format
    'npy',          -- NumPy array format
    'raw'           -- Raw binary format
);

-- Depth map cache table
CREATE TABLE depth_map_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Reference to media item
    media_item_id UUID NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
    
    -- File information
    file_path TEXT NOT NULL UNIQUE,
    file_size BIGINT NOT NULL,
    format depth_map_format NOT NULL DEFAULT 'png',
    
    -- Depth map properties
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    
    -- Model information
    model_name VARCHAR(255), -- e.g., 'Depth-Anything', 'MiDaS'
    model_version VARCHAR(127),
    
    -- Processing parameters (stored as JSON for flexibility)
    processing_params JSONB,
    
    -- Cache metadata
    checksum VARCHAR(64), -- SHA256 hash of depth map file
    generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    accessed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    access_count INTEGER NOT NULL DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Ensure one depth map per media item (can be relaxed for multiple versions)
    UNIQUE(media_item_id)
);

-- Indexes for efficient cache lookups
CREATE INDEX idx_depth_map_cache_media_item_id ON depth_map_cache(media_item_id);
CREATE INDEX idx_depth_map_cache_accessed_at ON depth_map_cache(accessed_at);
CREATE INDEX idx_depth_map_cache_generated_at ON depth_map_cache(generated_at);
CREATE INDEX idx_depth_map_cache_checksum ON depth_map_cache(checksum);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables
CREATE TRIGGER update_media_items_updated_at
    BEFORE UPDATE ON media_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_processing_queue_updated_at
    BEFORE UPDATE ON processing_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_depth_map_cache_updated_at
    BEFORE UPDATE ON depth_map_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View for monitoring processing queue status
CREATE VIEW processing_queue_summary AS
SELECT
    status,
    COUNT(*) as count,
    AVG(attempts) as avg_attempts,
    AVG(processing_duration_seconds) as avg_processing_time_seconds
FROM processing_queue
GROUP BY status;

-- View for media items with their processing status
CREATE VIEW media_processing_status AS
SELECT
    m.id as media_id,
    m.original_filename,
    m.media_type,
    m.uploaded_at,
    pq.status as processing_status,
    pq.attempts as processing_attempts,
    pq.last_error,
    dc.id as depth_map_id,
    dc.file_path as depth_map_path,
    dc.generated_at as depth_map_generated_at
FROM media_items m
LEFT JOIN processing_queue pq ON m.id = pq.media_item_id
LEFT JOIN depth_map_cache dc ON m.id = dc.media_item_id
ORDER BY m.uploaded_at DESC;

-- ============================================================================
-- COMMENTS
-- ============================================================================

-- Table comments
COMMENT ON TABLE media_items IS 'Stores metadata for photos and videos uploaded to ImmichVR';
COMMENT ON TABLE processing_queue IS 'Manages the queue for depth map processing with status tracking';
COMMENT ON TABLE depth_map_cache IS 'Caches generated depth map file paths and metadata';

-- Column comments
COMMENT ON COLUMN media_items.checksum IS 'SHA256 checksum of the original media file';
COMMENT ON COLUMN media_items.duration_seconds IS 'Duration of video in seconds (NULL for photos)';
COMMENT ON COLUMN processing_queue.priority IS 'Processing priority (1=highest, 10=lowest)';
COMMENT ON COLUMN depth_map_cache.processing_params IS 'JSON object containing processing parameters used to generate the depth map';
