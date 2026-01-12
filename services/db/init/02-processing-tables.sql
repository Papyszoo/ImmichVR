-- ImmichVR Database Schema: Processing Tables
-- Contains tables related to background processing, queueing, and generated assets (depth maps).

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

-- Depth map version enum (Added from migration 03)
CREATE TYPE depth_map_version AS ENUM ('thumbnail', 'full_resolution');

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
    
    -- Versioning (Added from migration 03)
    version_type depth_map_version NOT NULL DEFAULT 'full_resolution',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Ensure one depth map per media item and version
    CONSTRAINT depth_map_cache_media_item_version_unique UNIQUE (media_item_id, version_type)
);

-- Indexes for efficient cache lookups
CREATE INDEX idx_depth_map_cache_media_item_id ON depth_map_cache(media_item_id);
CREATE INDEX idx_depth_map_cache_accessed_at ON depth_map_cache(accessed_at);
CREATE INDEX idx_depth_map_cache_generated_at ON depth_map_cache(generated_at);
CREATE INDEX idx_depth_map_cache_checksum ON depth_map_cache(checksum);

-- Comments
COMMENT ON TABLE processing_queue IS 'Manages the queue for depth map processing with status tracking';
COMMENT ON COLUMN processing_queue.priority IS 'Processing priority (1=highest, 10=lowest)';

COMMENT ON TABLE depth_map_cache IS 'Caches generated depth map file paths and metadata';
COMMENT ON COLUMN depth_map_cache.processing_params IS 'JSON object containing processing parameters used to generate the depth map';
COMMENT ON COLUMN depth_map_cache.version_type IS 'Version of depth map: thumbnail (for gallery preview) or full_resolution (for detailed viewing)';
