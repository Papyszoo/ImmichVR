# ImmichVR Backend Service

Node.js/Express backend service providing API Gateway, Processing Queue Manager, and Immich integration for ImmichVR.

## Features

### API Gateway
- Routes requests between frontend, backend modules, and AI service
- Proxies health checks and info requests to AI service
- Handles multipart file uploads with validation

### Processing Queue Manager
- Priority-based queue system with two-tier priority:
  1. Photos processed before videos
  2. Smaller files processed first within each media type
- Automatic retry logic for failed jobs (configurable max attempts)
- Concurrent-safe queue processing using PostgreSQL's `FOR UPDATE SKIP LOCKED`
- Real-time queue monitoring and statistics

### Immich Integration (Optional)
- Connect to Immich instances to fetch media
- Browse photos and videos from Immich
- Download assets from Immich for processing

## Architecture

```
┌─────────────┐
│  Frontend   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│         Backend (Express)           │
│  ┌───────────────────────────────┐  │
│  │      API Gateway              │  │
│  │  - Routes & Validation        │  │
│  │  - File Upload Handling       │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │   Queue Manager               │  │
│  │  - Priority Calculation       │  │
│  │  - Queue Operations           │  │
│  │  - Retry Logic                │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │   Processing Worker           │  │
│  │  - Polls Queue                │  │
│  │  - Processes Items            │  │
│  │  - Saves Results              │  │
│  └───────────────────────────────┘  │
└────┬─────────────────────────┬──────┘
     │                         │
     ▼                         ▼
┌──────────┐            ┌──────────┐
│PostgreSQL│            │AI Service│
└──────────┘            └──────────┘
```

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 16+
- AI Service running (Python/Flask)

### Installation

```bash
cd services/backend
npm install
```

### Configuration

Set environment variables:

```bash
# Database
POSTGRES_USER=immichvr
POSTGRES_PASSWORD=changeme
POSTGRES_DB=immichvr
POSTGRES_HOST=localhost

# Server
BACKEND_PORT=3000

# AI Service
AI_SERVICE_URL=http://localhost:5000
AI_MODEL_NAME=Depth-Anything-V2
AI_MODEL_VERSION=small

# Storage
UPLOAD_DIR=/data/uploads
DEPTH_MAPS_DIR=/data/depth_maps

# Worker
AUTO_START_WORKER=true

# Immich (Optional)
IMMICH_URL=http://immich.example.com
IMMICH_API_KEY=your-api-key
```

### Running

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

## API Documentation

See [API_GATEWAY_QUEUE.md](./API_GATEWAY_QUEUE.md) for complete API documentation.

### Quick Reference

#### Queue Endpoints
- `GET /api/queue/stats` - Queue statistics
- `GET /api/queue/items` - List queue items
- `GET /api/queue/items/:id` - Get queue item details
- `POST /api/queue/enqueue/:mediaItemId` - Add to queue
- `POST /api/queue/items/:id/cancel` - Cancel item
- `POST /api/queue/items/:id/retry` - Retry failed item

#### Media Endpoints
- `POST /api/media/upload` - Upload and queue media
- `GET /api/media/status` - Media processing status

#### Worker Endpoints
- `GET /api/queue/worker/status` - Worker status
- `POST /api/queue/worker/start` - Start worker
- `POST /api/queue/worker/stop` - Stop worker

#### AI Service Endpoints
- `GET /api/ai/health` - AI service health
- `GET /api/ai/info` - AI service info

#### Immich Endpoints
See [IMMICH_CONNECTOR.md](./IMMICH_CONNECTOR.md) for Immich integration details.

## Modules

### queueManager.js
Priority-based queue management with retry logic.

**Key Methods:**
- `enqueueMediaItem(mediaItemId, maxAttempts)` - Add item to queue
- `getNextQueueItem()` - Get next item (concurrent-safe)
- `markCompleted(queueId, duration)` - Mark as completed
- `markFailed(queueId, error)` - Mark as failed (with retry)
- `getQueueStats()` - Get statistics
- `getQueueItems(options)` - List items with filtering

### apiGateway.js
Communication with AI service.

**Key Methods:**
- `checkAIServiceHealth()` - Health check
- `processDepthMap(filePath)` - Process media file
- `getAIServiceInfo()` - Service information

### processingWorker.js
Background worker for processing queue items.

**Key Methods:**
- `start(intervalMs)` - Start worker
- `stop()` - Stop worker
- `processNext()` - Process next item
- `getStatus()` - Worker status

### immichConnector.js
Integration with Immich instances (optional).

See [IMMICH_CONNECTOR.md](./IMMICH_CONNECTOR.md) for details.

## Testing

### Priority Calculation Test

```bash
node test-queue-priority.js
```

Expected output shows:
- Photos get priority 1-100
- Videos get priority 101-200
- Smaller files get lower numbers (higher priority)
- Photos always prioritized over videos

## Development

### Code Structure

```
services/backend/
├── index.js                 # Main Express app & routes
├── queueManager.js          # Queue management logic
├── apiGateway.js           # AI service communication
├── processingWorker.js     # Background worker
├── immichConnector.js      # Immich integration
├── package.json            # Dependencies
├── API_GATEWAY_QUEUE.md    # API documentation
├── IMMICH_CONNECTOR.md     # Immich docs
└── README.md               # This file
```

### Dependencies

- **express**: Web framework
- **pg**: PostgreSQL client
- **multer**: File upload handling
- **form-data**: Multipart form data
- **axios**: HTTP client for AI service

## Deployment

### Docker

The service is designed to run in Docker. See `docker-compose.yml` in the project root.

```bash
# Build
docker compose build backend

# Run
docker compose up backend

# Logs
docker compose logs -f backend
```

### Environment Variables

All configuration is via environment variables. Set them in `.env` file or `docker-compose.yml`.

### Health Check

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "backend",
  "database": "connected"
}
```

## Troubleshooting

### Worker not processing items
- Check worker status: `GET /api/queue/worker/status`
- Check AI service health: `GET /api/ai/health`
- Check logs for errors
- Manually start worker: `POST /api/queue/worker/start`

### Database connection issues
- Verify PostgreSQL is running
- Check `POSTGRES_*` environment variables
- Check database logs

### AI service connection issues
- Verify AI service is running: `curl http://ai:5000/health`
- Check `AI_SERVICE_URL` environment variable
- Check network connectivity

### Upload failures
- Check `UPLOAD_DIR` exists and is writable
- Verify file size is under 100MB limit
- Check disk space

## Security Notes

1. **File Size Limits**: 100MB max per file
2. **Rate Limiting**: Not implemented - add for production
3. **Authentication**: Not implemented - add for production
4. **File Validation**: Only basic MIME type checking
5. **Path Traversal**: Protected by absolute path usage

For production use, consider adding:
- Rate limiting (express-rate-limit)
- Authentication/authorization
- File type validation (file-type package)
- HTTPS/TLS
- CORS configuration
- Request size limits

## Contributing

When making changes:
1. Run syntax check: `node -c *.js`
2. Test priority calculation: `node test-queue-priority.js`
3. Update API documentation if endpoints change
4. Update this README if architecture changes

## License

MIT License - see [LICENSE](../../LICENSE) for details.
