-- Migration to support thumbnail and full-resolution media versions
-- This enables tracking and processing of both thumbnail and full-resolution files

-- Add thumbnail path to media_items table
ALTER TABLE media_items 
ADD COLUMN thumbnail_path TEXT;

-- Add source reference for Immich integration
ALTER TABLE media_items 
ADD COLUMN immich_asset_id VARCHAR(255),
ADD COLUMN source_type VARCHAR(50) DEFAULT 'upload'; -- 'upload' or 'immich'

-- Create index for Immich asset lookups
CREATE INDEX idx_media_items_immich_asset_id ON media_items(immich_asset_id);

-- Add version type to depth_map_cache
CREATE TYPE depth_map_version AS ENUM ('thumbnail', 'full_resolution');

ALTER TABLE depth_map_cache 
ADD COLUMN version_type depth_map_version NOT NULL DEFAULT 'full_resolution';

-- Drop the unique constraint on media_item_id to allow multiple versions
ALTER TABLE depth_map_cache 
DROP CONSTRAINT depth_map_cache_media_item_id_key;

-- Add new unique constraint for media_item_id + version_type
ALTER TABLE depth_map_cache 
ADD CONSTRAINT depth_map_cache_media_item_version_unique UNIQUE (media_item_id, version_type);

-- Update comments
COMMENT ON COLUMN media_items.thumbnail_path IS 'Path to thumbnail version (for preview), NULL if not available';
COMMENT ON COLUMN media_items.immich_asset_id IS 'Reference to Immich asset ID if media was fetched from Immich';
COMMENT ON COLUMN media_items.source_type IS 'Source of media: upload (direct upload) or immich (fetched from Immich)';
COMMENT ON COLUMN depth_map_cache.version_type IS 'Version of depth map: thumbnail (for gallery preview) or full_resolution (for detailed viewing)';

-- Update the media_processing_status view to include version information
DROP VIEW IF EXISTS media_processing_status;
CREATE VIEW media_processing_status AS
SELECT
    m.id as media_id,
    m.original_filename,
    m.media_type,
    m.uploaded_at,
    m.source_type,
    m.immich_asset_id,
    pq.status as processing_status,
    pq.attempts as processing_attempts,
    pq.last_error,
    dc_thumb.id as thumbnail_depth_map_id,
    dc_thumb.file_path as thumbnail_depth_map_path,
    dc_thumb.generated_at as thumbnail_depth_map_generated_at,
    dc_full.id as full_res_depth_map_id,
    dc_full.file_path as full_res_depth_map_path,
    dc_full.generated_at as full_res_depth_map_generated_at
FROM media_items m
LEFT JOIN processing_queue pq ON m.id = pq.media_item_id
LEFT JOIN depth_map_cache dc_thumb ON m.id = dc_thumb.media_item_id AND dc_thumb.version_type = 'thumbnail'
LEFT JOIN depth_map_cache dc_full ON m.id = dc_full.media_item_id AND dc_full.version_type = 'full_resolution'
ORDER BY m.uploaded_at DESC;

COMMENT ON VIEW media_processing_status IS 'Comprehensive view of media items with their processing status and depth map availability for both thumbnail and full-resolution versions';
