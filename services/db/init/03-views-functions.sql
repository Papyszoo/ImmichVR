-- ImmichVR Database Schema: Views and Functions
-- Contains utility functions, triggers, and views.

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
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

-- View for media items with their processing status (Updated from migration 03)
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
