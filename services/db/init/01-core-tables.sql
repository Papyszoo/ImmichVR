-- ImmichVR Database Schema: Core Tables
-- Contains extensions, common enums, and core entity tables (e.g. media_items).

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

    -- Immich Integration (Added from migration 03)
    thumbnail_path TEXT, -- Path to thumbnail version (for preview), NULL if not available
    immich_asset_id VARCHAR(255), -- Reference to Immich asset ID if media was fetched from Immich
    source_type VARCHAR(50) DEFAULT 'upload', -- 'upload' or 'immich'
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_media_items_media_type ON media_items(media_type);
CREATE INDEX idx_media_items_user_id ON media_items(user_id);
CREATE INDEX idx_media_items_uploaded_at ON media_items(uploaded_at);
CREATE INDEX idx_media_items_checksum ON media_items(checksum);
-- Index for Immich asset lookups (Added from migration 03)
CREATE INDEX idx_media_items_immich_asset_id ON media_items(immich_asset_id);

-- Comments
COMMENT ON TABLE media_items IS 'Stores metadata for photos and videos uploaded to ImmichVR';
COMMENT ON COLUMN media_items.checksum IS 'SHA256 checksum of the original media file';
COMMENT ON COLUMN media_items.duration_seconds IS 'Duration of video in seconds (NULL for photos)';
COMMENT ON COLUMN media_items.thumbnail_path IS 'Path to thumbnail version (for preview), NULL if not available';
COMMENT ON COLUMN media_items.immich_asset_id IS 'Reference to Immich asset ID if media was fetched from Immich';
COMMENT ON COLUMN media_items.source_type IS 'Source of media: upload (direct upload) or immich (fetched from Immich)';
