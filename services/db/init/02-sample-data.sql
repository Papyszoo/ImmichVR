-- ImmichVR Sample Data
-- This file contains sample data for testing and development purposes.
-- This file is optional and will only be loaded in development environments.

-- Insert sample media items
INSERT INTO media_items (
    id,
    original_filename,
    media_type,
    file_path,
    file_size,
    mime_type,
    width,
    height,
    duration_seconds,
    captured_at
) VALUES
    (
        '550e8400-e29b-41d4-a716-446655440001',
        'mountain_landscape.jpg',
        'photo',
        '/data/uploads/550e8400-e29b-41d4-a716-446655440001.jpg',
        2457600,
        'image/jpeg',
        3840,
        2160,
        NULL,
        '2024-01-15 14:30:00+00'
    ),
    (
        '550e8400-e29b-41d4-a716-446655440002',
        'beach_sunset.jpg',
        'photo',
        '/data/uploads/550e8400-e29b-41d4-a716-446655440002.jpg',
        1843200,
        'image/jpeg',
        2560,
        1440,
        NULL,
        '2024-02-20 18:45:00+00'
    ),
    (
        '550e8400-e29b-41d4-a716-446655440003',
        'city_timelapse.mp4',
        'video',
        '/data/uploads/550e8400-e29b-41d4-a716-446655440003.mp4',
        52428800,
        'video/mp4',
        1920,
        1080,
        30.5,
        '2024-03-10 10:15:00+00'
    );

-- Insert sample processing queue entries
INSERT INTO processing_queue (
    media_item_id,
    status,
    priority,
    attempts,
    queued_at
) VALUES
    (
        '550e8400-e29b-41d4-a716-446655440001',
        'completed',
        5,
        1,
        '2024-01-15 14:35:00+00'
    ),
    (
        '550e8400-e29b-41d4-a716-446655440002',
        'processing',
        3,
        1,
        '2024-02-20 18:50:00+00'
    ),
    (
        '550e8400-e29b-41d4-a716-446655440003',
        'pending',
        5,
        0,
        '2024-03-10 10:20:00+00'
    );

-- Insert sample depth map cache entry
INSERT INTO depth_map_cache (
    media_item_id,
    file_path,
    file_size,
    format,
    width,
    height,
    model_name,
    model_version,
    processing_params
) VALUES
    (
        '550e8400-e29b-41d4-a716-446655440001',
        '/data/depth_maps/550e8400-e29b-41d4-a716-446655440001_depth.png',
        1024000,
        'png',
        3840,
        2160,
        'Depth-Anything',
        'v1.0',
        '{"model_size": "base", "precision": "fp16", "device": "cuda"}'::jsonb
    );
