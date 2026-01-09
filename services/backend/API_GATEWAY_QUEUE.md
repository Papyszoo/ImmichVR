# API Gateway & Queue Manager Documentation

This document describes the API Gateway and Processing Queue Manager implementation for ImmichVR.

## Overview

The API Gateway handles routing between the frontend, backend modules, and AI service. The Processing Queue Manager implements a priority-based queue system for media processing with automatic retry logic.

## Architecture

### Components

1. **QueueManager** (`queueManager.js`): Manages the processing queue with priority-based ordering
2. **APIGateway** (`apiGateway.js`): Routes requests to the AI service
3. **ProcessingWorker** (`processingWorker.js`): Processes queue items and coordinates with AI service
4. **Express Routes** (`index.js`): REST API endpoints

### Priority Rules

The queue implements a two-tier priority system:

1. **Priority 1**: Photos are processed before videos
2. **Priority 2**: Within each media type, smaller files are processed first

Priority numbers range from 1-200:
- Photos: 1-100 (smaller files get lower numbers)
- Videos: 101-200 (smaller files get lower numbers)

## API Endpoints

### Queue Management

#### Get Queue Statistics
```
GET /api/queue/stats
```

Returns aggregate statistics about the queue.

**Response:**
```json
{
  "stats": {
    "queued": 5,
    "processing": 1,
    "completed": 42,
    "failed": 2,
    "cancelled": 0,
    "pending": 0
  },
  "timestamp": "2024-01-09T12:00:00.000Z"
}
```

#### Get Queue Items
```
GET /api/queue/items?status=queued&limit=50&offset=0&orderBy=priority&orderDirection=ASC
```

Returns a list of queue items with optional filtering and pagination.

**Query Parameters:**
- `status` (optional): Filter by status (queued, processing, completed, failed, cancelled, pending)
- `limit` (optional, default: 50): Maximum number of items to return
- `offset` (optional, default: 0): Number of items to skip
- `orderBy` (optional, default: priority): Field to order by
- `orderDirection` (optional, default: ASC): Sort direction (ASC or DESC)

**Response:**
```json
{
  "count": 5,
  "items": [
    {
      "id": "uuid",
      "media_item_id": "uuid",
      "status": "queued",
      "priority": 2,
      "attempts": 0,
      "max_attempts": 3,
      "last_error": null,
      "queued_at": "2024-01-09T12:00:00.000Z",
      "started_at": null,
      "completed_at": null,
      "original_filename": "photo.jpg",
      "media_type": "photo",
      "file_size": 1048576
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0
  }
}
```

#### Get Queue Item by ID
```
GET /api/queue/items/:queueId
```

Returns details for a specific queue item.

**Response:**
```json
{
  "id": "uuid",
  "media_item_id": "uuid",
  "status": "processing",
  "priority": 2,
  "attempts": 1,
  "max_attempts": 3,
  "last_error": null,
  "queued_at": "2024-01-09T12:00:00.000Z",
  "started_at": "2024-01-09T12:01:00.000Z",
  "completed_at": null,
  "original_filename": "photo.jpg",
  "media_type": "photo",
  "file_size": 1048576,
  "file_path": "/data/uploads/photo.jpg"
}
```

#### Enqueue Existing Media Item
```
POST /api/queue/enqueue/:mediaItemId
```

Adds an existing media item to the processing queue.

**Body (optional):**
```json
{
  "maxAttempts": 3
}
```

**Response:**
```json
{
  "success": true,
  "message": "Media item added to queue",
  "queueId": "uuid",
  "mediaItemId": "uuid"
}
```

#### Cancel Queue Item
```
POST /api/queue/items/:queueId/cancel
```

Cancels a queued or pending item.

**Response:**
```json
{
  "success": true,
  "message": "Queue item cancelled",
  "queueId": "uuid"
}
```

#### Retry Failed Queue Item
```
POST /api/queue/items/:queueId/retry
```

Resets a failed queue item and adds it back to the queue.

**Response:**
```json
{
  "success": true,
  "message": "Queue item will be retried",
  "queueId": "uuid"
}
```

### Media Upload

#### Upload Media
```
POST /api/media/upload
```

Uploads a media file and automatically adds it to the processing queue.

**Content-Type:** `multipart/form-data`

**Form Data:**
- `media`: The media file (photo or video)

**Response:**
```json
{
  "success": true,
  "message": "Media uploaded and queued for processing",
  "mediaItemId": "uuid",
  "queueId": "uuid",
  "filename": "photo.jpg",
  "size": 1048576,
  "type": "photo"
}
```

### Processing Worker Control

#### Get Worker Status
```
GET /api/queue/worker/status
```

Returns the current status of the processing worker.

**Response:**
```json
{
  "running": true,
  "processing": false,
  "aiServiceUrl": "http://ai:5000"
}
```

#### Start Worker
```
POST /api/queue/worker/start
```

Starts the processing worker.

**Response:**
```json
{
  "success": true,
  "message": "Processing worker started"
}
```

#### Stop Worker
```
POST /api/queue/worker/stop
```

Stops the processing worker.

**Response:**
```json
{
  "success": true,
  "message": "Processing worker stopped"
}
```

### AI Service Gateway

#### AI Service Health Check
```
GET /api/ai/health
```

Proxies health check to the AI service.

**Response:**
```json
{
  "status": "healthy",
  "service": "ai",
  "model": "Depth-Anything-V2",
  "model_status": "loaded"
}
```

#### AI Service Info
```
GET /api/ai/info
```

Proxies info request to the AI service.

**Response:**
```json
{
  "message": "ImmichVR AI Service",
  "version": "1.0.0",
  "model": "Depth Anything V2",
  "endpoints": {
    "health": "/health",
    "process_depth": "/api/depth (POST)"
  }
}
```

## Queue Processing Flow

1. Media is uploaded via `/api/media/upload` or existing media is enqueued via `/api/queue/enqueue/:mediaItemId`
2. QueueManager calculates priority based on media type and file size
3. Item is inserted into `processing_queue` table with status `queued`
4. ProcessingWorker polls the queue every 5 seconds (configurable)
5. Worker picks the next item using priority ordering (lowest priority number = highest priority)
6. Worker updates status to `processing` and increments attempt counter
7. Worker sends file to AI service via APIGateway
8. AI service returns depth map
9. Worker saves depth map to disk and records metadata in `depth_map_cache` table
10. Worker marks queue item as `completed` with processing duration

### Retry Logic

If processing fails:

1. Worker marks item as failed and stores error message
2. QueueManager checks if attempts < max_attempts
3. If retries remain, status is set back to `queued` (auto-retry)
4. If max attempts reached, status remains `failed`
5. Failed items can be manually retried via `/api/queue/items/:queueId/retry`

## Configuration

Environment variables (set in `.env` or `docker-compose.yml`):

- `AI_SERVICE_URL`: URL of the AI service (default: `http://ai:5000`)
- `UPLOAD_DIR`: Directory for uploaded media (default: `/data/uploads`)
- `DEPTH_MAPS_DIR`: Directory for generated depth maps (default: `/data/depth_maps`)
- `AUTO_START_WORKER`: Auto-start processing worker on startup (default: `true`)

## Database Schema

The implementation uses existing tables:

- `media_items`: Stores media file metadata
- `processing_queue`: Tracks queue items and processing status
- `depth_map_cache`: Stores generated depth map metadata

**Note:** The current implementation stores depth map dimensions as 0 (placeholder). To store accurate dimensions, an image processing library like `sharp` would need to be added as a dependency.

See [SCHEMA.md](../../services/db/SCHEMA.md) for full schema documentation.

## Example Usage

### Upload and Process a Photo

```bash
# Upload a photo
curl -X POST http://localhost:3000/api/media/upload \
  -F "media=@photo.jpg"

# Response includes queueId and mediaItemId

# Check queue status
curl http://localhost:3000/api/queue/stats

# Get queue items
curl http://localhost:3000/api/queue/items?status=queued

# Check worker status
curl http://localhost:3000/api/queue/worker/status
```

### Monitor Processing

```bash
# Get specific queue item status
curl http://localhost:3000/api/queue/items/{queueId}

# Get all processing items
curl http://localhost:3000/api/queue/items?status=processing

# Get completed items
curl http://localhost:3000/api/queue/items?status=completed&limit=10
```

### Handle Failed Items

```bash
# Get failed items
curl http://localhost:3000/api/queue/items?status=failed

# Retry a failed item
curl -X POST http://localhost:3000/api/queue/items/{queueId}/retry

# Cancel a queued item
curl -X POST http://localhost:3000/api/queue/items/{queueId}/cancel
```

## Testing

Priority calculation can be tested with:

```bash
cd services/backend
node test-queue-priority.js
```

## Error Handling

All endpoints return appropriate HTTP status codes:

- `200`: Success
- `201`: Created
- `400`: Bad request (invalid input)
- `404`: Not found
- `500`: Server error
- `503`: Service unavailable (AI service down)

Error responses include `error` and `message` fields:

```json
{
  "error": "Failed to process item",
  "message": "AI service returned status 500"
}
```

## Monitoring

Monitor queue health via:

1. `/api/queue/stats` - Aggregate statistics
2. `/api/queue/summary` - Database view with averages
3. `/api/media/status` - Combined media and processing status
4. `/api/queue/worker/status` - Worker health

## Performance Considerations

- Queue polling interval: 5 seconds (configurable in code)
- Database uses `FOR UPDATE SKIP LOCKED` for concurrent processing
- Indexes on `status`, `priority`, and `queued_at` for efficient queries
- Worker processes one item at a time to avoid resource exhaustion
- AI service timeout: 120 seconds

## Security Considerations

- File size limit: 100MB (configurable in multer config)
- Files stored in isolated directories
- Database CASCADE DELETE ensures referential integrity
- No direct file path exposure in API responses
