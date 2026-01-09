# ImmichVR Database Schema Documentation

## Overview

The ImmichVR database schema is designed to support metadata storage, processing queue tracking, and caching of generated depth maps for both photos and videos. The schema is built on PostgreSQL and uses modern features like JSONB for flexible data storage and enums for type safety.

## Entity Relationship Diagram (ERD)

```
┌─────────────────────────────────────────────────────────────┐
│                        media_items                          │
├─────────────────────────────────────────────────────────────┤
│ PK  id (UUID)                                               │
│     original_filename (VARCHAR)                             │
│     media_type (ENUM: photo, video)                         │
│     file_path (TEXT)                                        │
│     file_size (BIGINT)                                      │
│     mime_type (VARCHAR)                                     │
│     width, height (INTEGER)                                 │
│     duration_seconds (DECIMAL) [videos only]                │
│     frame_rate (DECIMAL) [videos only]                      │
│     checksum (VARCHAR)                                      │
│     captured_at, uploaded_at (TIMESTAMP)                    │
│     user_id (UUID)                                          │
│     created_at, updated_at (TIMESTAMP)                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ 1
                              │
                ┌─────────────┴──────────────┐
                │                            │
                │ 1                          │ 1
                │                            │
                ▼                            ▼
┌───────────────────────────────┐  ┌──────────────────────────────────┐
│     processing_queue          │  │       depth_map_cache            │
├───────────────────────────────┤  ├──────────────────────────────────┤
│ PK  id (UUID)                 │  │ PK  id (UUID)                    │
│ FK  media_item_id (UUID)      │  │ FK  media_item_id (UUID)         │
│     status (ENUM)             │  │     file_path (TEXT) UNIQUE      │
│     priority (INTEGER)        │  │     file_size (BIGINT)           │
│     attempts, max_attempts    │  │     format (ENUM)                │
│     last_error (TEXT)         │  │     width, height (INTEGER)      │
│     error_count (INTEGER)     │  │     model_name (VARCHAR)         │
│     queued_at (TIMESTAMP)     │  │     model_version (VARCHAR)      │
│     started_at (TIMESTAMP)    │  │     processing_params (JSONB)    │
│     completed_at (TIMESTAMP)  │  │     checksum (VARCHAR)           │
│     processing_duration       │  │     generated_at (TIMESTAMP)     │
│     created_at, updated_at    │  │     accessed_at (TIMESTAMP)      │
└───────────────────────────────┘  │     access_count (INTEGER)       │
                                   │     created_at, updated_at       │
                                   └──────────────────────────────────┘
```

## Tables

### 1. media_items

**Purpose**: Store metadata for all media files (photos and videos) uploaded to ImmichVR.

**Key Features**:
- Supports both photos and videos with a `media_type` enum
- Stores file information (path, size, MIME type)
- Captures media properties (dimensions, duration, frame rate)
- Includes checksums for integrity verification
- Extensible with user_id for future multi-user support

**Columns**:
- `id`: Primary key (UUID)
- `original_filename`: Original name of the uploaded file
- `media_type`: Either 'photo' or 'video'
- `file_path`: Full path to the stored media file
- `file_size`: Size in bytes
- `mime_type`: MIME type (e.g., image/jpeg, video/mp4)
- `width`, `height`: Media dimensions in pixels
- `duration_seconds`: Video duration (NULL for photos)
- `frame_rate`: Video frame rate (NULL for photos)
- `checksum`: SHA256 hash for integrity checks
- `captured_at`: When the media was originally captured
- `uploaded_at`: When the media was uploaded to ImmichVR
- `user_id`: Optional reference to user (for future multi-user support)
- `created_at`, `updated_at`: Audit timestamps

**Indexes**:
- `idx_media_items_media_type`: Fast filtering by media type
- `idx_media_items_user_id`: Fast filtering by user
- `idx_media_items_uploaded_at`: Fast sorting by upload date
- `idx_media_items_checksum`: Fast duplicate detection

### 2. processing_queue

**Purpose**: Manage the queue for depth map generation with comprehensive status tracking.

**Key Features**:
- Tracks processing status through the entire lifecycle
- Supports priority-based processing
- Includes retry logic with attempt tracking
- Captures error information for debugging
- Records processing time metrics

**Columns**:
- `id`: Primary key (UUID)
- `media_item_id`: Foreign key to media_items (CASCADE DELETE)
- `status`: Current processing status (pending, queued, processing, completed, failed, cancelled)
- `priority`: Processing priority (1=highest, 10=lowest)
- `attempts`: Number of processing attempts
- `max_attempts`: Maximum allowed attempts before giving up
- `last_error`: Error message from last failed attempt
- `error_count`: Total number of errors encountered
- `queued_at`: When the item was added to the queue
- `started_at`: When processing began
- `completed_at`: When processing finished
- `processing_duration_seconds`: Time taken to process
- `created_at`, `updated_at`: Audit timestamps

**Status Flow**:
```
pending → queued → processing → completed
                              ↘ failed → (retry) → queued
                              ↘ cancelled
```

**Indexes**:
- `idx_processing_queue_status`: Fast filtering by status
- `idx_processing_queue_media_item_id`: Fast lookup by media item
- `idx_processing_queue_priority`: Fast priority-based queue management
- `idx_processing_queue_status_priority`: Optimized for queue processing

### 3. depth_map_cache

**Purpose**: Cache generated depth map file paths and associated metadata.

**Key Features**:
- Stores file location and format information
- Tracks model information for reproducibility
- Flexible processing parameters stored as JSONB
- Access tracking for cache management
- Integrity verification with checksums

**Columns**:
- `id`: Primary key (UUID)
- `media_item_id`: Foreign key to media_items (CASCADE DELETE, UNIQUE)
- `file_path`: Full path to the depth map file (UNIQUE)
- `file_size`: Size of the depth map in bytes
- `format`: Depth map format (png, exr, npy, raw)
- `width`, `height`: Depth map dimensions
- `model_name`: AI model used (e.g., 'Depth-Anything')
- `model_version`: Version of the AI model
- `processing_params`: JSONB object with processing parameters
- `checksum`: SHA256 hash of the depth map file
- `generated_at`: When the depth map was created
- `accessed_at`: When the depth map was last accessed
- `access_count`: Number of times accessed
- `created_at`, `updated_at`: Audit timestamps

**Constraints**:
- `UNIQUE(media_item_id)`: One depth map per media item (can be relaxed for multiple versions)
- `UNIQUE(file_path)`: Each file path appears only once

**Indexes**:
- `idx_depth_map_cache_media_item_id`: Fast lookup by media item
- `idx_depth_map_cache_accessed_at`: Fast cache eviction based on access time
- `idx_depth_map_cache_generated_at`: Fast filtering by generation time
- `idx_depth_map_cache_checksum`: Fast integrity verification

## Enums

### media_type
- `photo`: Still image/photograph
- `video`: Video file

### processing_status
- `pending`: Waiting to be queued
- `queued`: In the processing queue
- `processing`: Currently being processed
- `completed`: Successfully processed
- `failed`: Processing failed
- `cancelled`: Processing was cancelled

### depth_map_format
- `png`: PNG image format
- `exr`: OpenEXR format (high dynamic range)
- `npy`: NumPy array format
- `raw`: Raw binary format

## Views

### processing_queue_summary

Provides an aggregated view of processing queue statistics by status.

**Columns**:
- `status`: Processing status
- `count`: Number of items with this status
- `avg_attempts`: Average number of attempts
- `avg_processing_time_seconds`: Average processing duration

**Usage**: Monitor overall queue health and performance.

### media_processing_status

Combines media items with their processing status and depth map information.

**Columns**:
- `media_id`: Media item ID
- `original_filename`: Original filename
- `media_type`: Photo or video
- `uploaded_at`: Upload timestamp
- `processing_status`: Current processing status
- `processing_attempts`: Number of processing attempts
- `last_error`: Last error message (if any)
- `depth_map_id`: Depth map ID (if generated)
- `depth_map_path`: Path to depth map file
- `depth_map_generated_at`: When depth map was created

**Usage**: Get complete processing status for all media in one query.

## Triggers

### update_updated_at_column

Automatically updates the `updated_at` column whenever a row is modified in any table.

**Applied to**:
- `media_items`
- `processing_queue`
- `depth_map_cache`

## Extensibility

The schema is designed to be extensible for future enhancements:

1. **Multi-user support**: The `user_id` column in `media_items` is ready for linking to a future `users` table.

2. **Multiple depth map versions**: The `UNIQUE(media_item_id)` constraint on `depth_map_cache` can be removed to allow multiple depth maps per media item (e.g., different models, resolutions).

3. **Processing parameters**: The JSONB `processing_params` column allows flexible storage of any processing configuration without schema changes.

4. **Custom metadata**: JSONB columns can be added to any table for custom metadata without altering the schema.

5. **Video frame processing**: The schema supports video metadata but can be extended with a `video_frames` table for frame-by-frame depth processing.

## Migration Strategy

### Initial Setup

The schema is initialized via Docker volume mounting to PostgreSQL's init directory:

1. `01-schema.sql`: Creates all tables, indexes, views, and triggers
2. `02-sample-data.sql`: Optional sample data for development/testing

### Future Migrations

For future schema changes, follow this pattern:

1. Create numbered migration files: `03-add-feature.sql`, `04-modify-table.sql`, etc.
2. Use `ALTER TABLE` statements for modifications
3. Include rollback scripts for each migration
4. Test migrations on a copy of production data

### Migration Best Practices

- Always use transactions for migrations
- Create indexes `CONCURRENTLY` in production
- Test rollback procedures
- Document breaking changes
- Version control all migration files

## Usage Examples

### Insert a new photo
```sql
INSERT INTO media_items (original_filename, media_type, file_path, file_size, mime_type, width, height)
VALUES ('vacation.jpg', 'photo', '/data/uploads/vacation.jpg', 2048000, 'image/jpeg', 4000, 3000);
```

### Queue a media item for processing
```sql
INSERT INTO processing_queue (media_item_id, priority)
SELECT id, 5 FROM media_items WHERE original_filename = 'vacation.jpg';
```

### Get next item to process
```sql
SELECT pq.id, pq.media_item_id, m.file_path
FROM processing_queue pq
JOIN media_items m ON pq.media_item_id = m.id
WHERE pq.status = 'queued'
ORDER BY pq.priority ASC, pq.queued_at ASC
LIMIT 1
FOR UPDATE SKIP LOCKED;
```

### Update processing status
```sql
UPDATE processing_queue
SET status = 'processing', started_at = NOW(), attempts = attempts + 1
WHERE id = '<queue_id>';
```

### Cache a generated depth map
```sql
INSERT INTO depth_map_cache (
    media_item_id, file_path, file_size, format, width, height,
    model_name, model_version, processing_params
)
VALUES (
    '<media_id>',
    '/data/depth_maps/vacation_depth.png',
    512000,
    'png',
    4000,
    3000,
    'Depth-Anything',
    'v1.0',
    '{"model_size": "base", "precision": "fp16"}'::jsonb
);
```

### Get processing statistics
```sql
SELECT * FROM processing_queue_summary;
```

### Find media without depth maps
```sql
SELECT m.id, m.original_filename
FROM media_items m
LEFT JOIN depth_map_cache dc ON m.id = dc.media_item_id
WHERE dc.id IS NULL;
```

## Performance Considerations

1. **Indexes**: All foreign keys and commonly queried columns are indexed
2. **UUID Primary Keys**: Provide better distribution across partitions
3. **JSONB**: Allows flexible schema while maintaining query performance
4. **Views**: Pre-computed joins for common queries
5. **Triggers**: Automatically maintain audit fields
6. **FOR UPDATE SKIP LOCKED**: Enables concurrent queue processing

## Security Considerations

1. **Checksums**: File integrity verification for both media and depth maps
2. **Cascade Deletes**: Automatically clean up related records
3. **Type Safety**: Enums prevent invalid status values
4. **Timestamps**: Full audit trail for all records
5. **Constraints**: Enforce data integrity at the database level

## Backup and Maintenance

### Recommended Backup Strategy
- Daily full backups of the database
- Transaction log backups every 15 minutes
- Test restore procedures monthly

### Maintenance Tasks
- Vacuum analyze tables weekly
- Reindex monthly
- Monitor table bloat
- Archive old completed queue items
- Clean up orphaned depth map files

## Support

For questions or issues with the database schema, please refer to:
- ImmichVR Documentation: See main README.md
- PostgreSQL Documentation: https://www.postgresql.org/docs/
- GitHub Issues: https://github.com/Papyszoo/ImmichVR/issues
