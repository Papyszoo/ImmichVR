# Media Fetch Logic: Thumbnails & Full-Resolution

This document describes the implementation of dual-version media processing in ImmichVR, enabling the system to handle both thumbnail and full-resolution versions of media files.

## Overview

The system now supports fetching, processing, and serving two versions of media files:
- **Thumbnail**: Smaller preview version for gallery display and quick loading
- **Full-Resolution**: Original high-quality version for detailed viewing

## Architecture Changes

### 1. Database Schema

#### media_items Table
New columns added:
- `thumbnail_path` (TEXT): Path to thumbnail version file
- `immich_asset_id` (VARCHAR(255)): Reference to Immich asset ID (for imported media)
- `source_type` (VARCHAR(50)): Source of media ('upload' or 'immich')

#### depth_map_cache Table
New columns and constraints:
- `version_type` (ENUM): Type of depth map version ('thumbnail' or 'full_resolution')
- Unique constraint changed from `(media_item_id)` to `(media_item_id, version_type)`

This allows storing separate depth maps for each version.

#### Updated Views
The `media_processing_status` view now includes:
- `thumbnail_depth_map_id`, `thumbnail_depth_map_path`, `thumbnail_depth_map_generated_at`
- `full_res_depth_map_id`, `full_res_depth_map_path`, `full_res_depth_map_generated_at`

### 2. Processing Worker

The `ProcessingWorker` has been updated to:
1. Check if a thumbnail version exists for a media item
2. Process the thumbnail version first (if available)
3. Process the full-resolution version
4. Store separate depth maps for each version with distinct filenames:
   - Thumbnail: `{filename}_{id}_thumb_depth.png`
   - Full-resolution: `{filename}_{id}_depth.png`

### 3. API Endpoints

#### New Endpoints

##### Import from Immich
```
POST /api/immich/import/:assetId
```
Fetches both thumbnail and full-resolution versions from Immich and imports them into the system.

**Response:**
```json
{
  "success": true,
  "message": "Media imported from Immich and queued for processing",
  "mediaItemId": "uuid",
  "queueId": "uuid",
  "assetId": "immich-asset-id",
  "filename": "photo.jpg",
  "thumbnailSize": 150000,
  "fullResSize": 5000000
}
```

##### Get Depth Map by Version
```
GET /api/media/:mediaItemId/depth?version={thumbnail|full_resolution}
```
Retrieves the depth map for a specific version of a media item.

**Query Parameters:**
- `version`: Either `thumbnail` or `full_resolution` (default: `full_resolution`)

**Response:**
- Content-Type: `image/png`
- Headers:
  - `X-Depth-Map-Version`: Version type
  - `X-Model-Name`: AI model used
  - `X-Model-Version`: Model version
  - `X-Generated-At`: Generation timestamp

##### Get Depth Map Metadata
```
GET /api/media/:mediaItemId/depth/info
```
Retrieves metadata about all available depth map versions without downloading the files.

**Response:**
```json
{
  "mediaItemId": "uuid",
  "depthMaps": [
    {
      "version_type": "thumbnail",
      "file_size": 50000,
      "format": "png",
      "width": 640,
      "height": 480,
      "model_name": "Depth-Anything-V2",
      "model_version": "small",
      "generated_at": "2024-01-15T10:30:00Z",
      "access_count": 5
    },
    {
      "version_type": "full_resolution",
      "file_size": 200000,
      "format": "png",
      "width": 1920,
      "height": 1080,
      "model_name": "Depth-Anything-V2",
      "model_version": "small",
      "generated_at": "2024-01-15T10:31:00Z",
      "access_count": 2
    }
  ]
}
```

## Usage Examples

### Importing from Immich

```bash
# Import a photo from Immich
curl -X POST http://localhost:3000/api/immich/import/IMMICH_ASSET_ID \
  -H "Content-Type: application/json"
```

The system will:
1. Fetch asset metadata from Immich
2. Download both thumbnail and full-resolution versions
3. Store both files locally
4. Create a media_item record with both paths
5. Queue the item for processing

### Retrieving Depth Maps

```bash
# Get thumbnail depth map
curl http://localhost:3000/api/media/MEDIA_ITEM_ID/depth?version=thumbnail \
  -o thumbnail_depth.png

# Get full-resolution depth map
curl http://localhost:3000/api/media/MEDIA_ITEM_ID/depth?version=full_resolution \
  -o fullres_depth.png

# Get depth map metadata
curl http://localhost:3000/api/media/MEDIA_ITEM_ID/depth/info
```

## Processing Flow

### For Immich-imported Media

```
1. POST /api/immich/import/:assetId
   ↓
2. Fetch thumbnail from Immich (preview size)
   ↓
3. Fetch full-resolution from Immich
   ↓
4. Store both files locally
   ↓
5. Create media_item with both paths
   ↓
6. Add to processing queue
   ↓
7. Worker processes thumbnail (AI service)
   ↓
8. Worker processes full-resolution (AI service)
   ↓
9. Store both depth maps in cache
   ↓
10. Mark queue item as completed
```

### For Direct Uploads

Currently, direct uploads only store the full-resolution file. To support thumbnails for uploads, you would need to:
1. Generate thumbnails during upload (using a library like `sharp`)
2. Store the thumbnail path in the media_item record
3. The worker will then process both versions

## Benefits

1. **Faster Gallery Loading**: Thumbnail depth maps load quickly for gallery views
2. **Bandwidth Efficiency**: Frontend can request appropriate version based on viewport
3. **Progressive Loading**: Show thumbnail depth map while full-resolution loads
4. **Flexible Display**: Different versions for different use cases (preview vs. detail view)

## Migration Notes

When applying the schema migration:
1. Existing media_items will have `NULL` for `thumbnail_path`
2. Existing depth_map_cache entries default to `version_type = 'full_resolution'`
3. The system is backward compatible - if no thumbnail exists, only full-resolution is processed
4. The migration is applied via `/services/db/init/03-media-versions-migration.sql`

## Testing

Run the integration test to verify the implementation:

```bash
cd services/backend
node test-media-versions.js
```

This test validates:
- Database schema changes
- Enum types and constraints
- View updates
- Data insertion for both versions
- Query capabilities

## Future Enhancements

Potential improvements:
1. Automatic thumbnail generation during upload
2. Configurable thumbnail sizes
3. Multiple resolution tiers (thumbnail, preview, full)
4. On-demand depth map regeneration
5. Cache eviction policies based on access patterns
