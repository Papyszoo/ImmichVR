const express = require('express');
const { Pool } = require('pg');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const ImmichConnector = require('./immichConnector');
const QueueManager = require('./queueManager');
const APIGateway = require('./apiGateway');
const ProcessingWorker = require('./processingWorker');

const app = express();
const PORT = process.env.BACKEND_PORT || 3000;

// Configure multer for file uploads
const uploadDir = process.env.UPLOAD_DIR || '/data/uploads';
const upload = multer({ 
  dest: uploadDir,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB max file size
  }
});

// Database connection pool
const pool = new Pool({
  user: process.env.POSTGRES_USER || 'immichvr',
  password: process.env.POSTGRES_PASSWORD || 'changeme',
  host: process.env.POSTGRES_HOST || 'db',
  database: process.env.POSTGRES_DB || 'immichvr',
  port: 5432,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test database connection on startup
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connected successfully at:', res.rows[0].now);
  }
});

// Initialize Queue Manager
const queueManager = new QueueManager(pool);
console.log('Queue Manager initialized');

// Initialize API Gateway
const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://ai:5000';
const apiGateway = new APIGateway(aiServiceUrl);
console.log(`API Gateway initialized with AI service URL: ${aiServiceUrl}`);

// Initialize Processing Worker
const processingWorker = new ProcessingWorker(queueManager, apiGateway, pool);

// Start processing worker if enabled (default: true)
const autoStartWorker = process.env.AUTO_START_WORKER !== 'false';
if (autoStartWorker) {
  // Wait a bit for services to be ready, then start
  setTimeout(() => {
    processingWorker.start(5000); // Check queue every 5 seconds
  }, 3000);
}

// Ensure upload directory exists
fs.mkdir(uploadDir, { recursive: true }).catch(err => {
  console.error('Failed to create upload directory:', err);
});

// Initialize Immich connector (optional - only if credentials are provided)
let immichConnector = null;
try {
  if (process.env.IMMICH_URL && process.env.IMMICH_API_KEY) {
    immichConnector = new ImmichConnector({
      url: process.env.IMMICH_URL,
      apiKey: process.env.IMMICH_API_KEY,
    });
    console.log('Immich connector initialized successfully');
  } else {
    console.log('Immich connector not initialized: IMMICH_URL or IMMICH_API_KEY not configured');
  }
} catch (error) {
  console.error('Failed to initialize Immich connector:', error.message);
}

app.use(express.json());

app.get('/health', async (req, res) => {
  try {
    // Check database connectivity
    const result = await pool.query('SELECT 1 as health_check');
    res.json({ 
      status: 'healthy', 
      service: 'backend',
      database: 'connected'
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'unhealthy', 
      service: 'backend',
      database: 'disconnected',
      error: error.message
    });
  }
});

app.get('/', (req, res) => {
  res.json({ message: 'ImmichVR Backend Service', version: '1.0.0' });
});

// Database schema info endpoint
app.get('/api/db/info', async (req, res) => {
  try {
    const tablesQuery = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    const viewsQuery = await pool.query(`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    res.json({
      database: process.env.POSTGRES_DB || 'immichvr',
      tables: tablesQuery.rows.map(r => r.table_name),
      views: viewsQuery.rows.map(r => r.table_name),
      status: 'connected'
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Database query failed', 
      message: error.message 
    });
  }
});

// Get processing queue summary
app.get('/api/queue/summary', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM processing_queue_summary ORDER BY status');
    res.json({
      summary: result.rows
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to fetch queue summary', 
      message: error.message 
    });
  }
});

// Get media processing status
app.get('/api/media/status', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM media_processing_status LIMIT 100');
    res.json({
      count: result.rowCount,
      media: result.rows
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to fetch media status', 
      message: error.message 
    });
  }
});

// ============================================================================
// API GATEWAY ENDPOINTS
// ============================================================================

// AI Service health check proxy
app.get('/api/ai/health', async (req, res) => {
  try {
    const health = await apiGateway.checkAIServiceHealth();
    if (health.healthy) {
      res.json(health.data);
    } else {
      res.status(503).json({ 
        error: 'AI service unhealthy', 
        message: health.error 
      });
    }
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to check AI service health', 
      message: error.message 
    });
  }
});

// AI Service info proxy
app.get('/api/ai/info', async (req, res) => {
  try {
    const info = await apiGateway.getAIServiceInfo();
    res.json(info);
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get AI service info', 
      message: error.message 
    });
  }
});

// ============================================================================
// MEDIA UPLOAD & QUEUE ENDPOINTS
// ============================================================================

// Upload media and add to processing queue
app.post('/api/media/upload', upload.single('media'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ 
      error: 'No file uploaded', 
      message: 'Please upload a media file' 
    });
  }

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Determine media type from MIME type
    let mediaType = 'photo';
    if (req.file.mimetype.startsWith('video/')) {
      mediaType = 'video';
    }

    // Insert media item
    const mediaResult = await client.query(
      `INSERT INTO media_items 
       (original_filename, media_type, file_path, file_size, mime_type)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        req.file.originalname,
        mediaType,
        req.file.path,
        req.file.size,
        req.file.mimetype
      ]
    );

    const mediaItemId = mediaResult.rows[0].id;

    // Add to processing queue
    const queueId = await queueManager.enqueueMediaItem(mediaItemId);

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Media uploaded and queued for processing',
      mediaItemId,
      queueId,
      filename: req.file.originalname,
      size: req.file.size,
      type: mediaType
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Upload error:', error);
    res.status(500).json({ 
      error: 'Failed to upload media', 
      message: error.message 
    });
  } finally {
    client.release();
  }
});

// ============================================================================
// QUEUE MANAGEMENT ENDPOINTS
// ============================================================================

// Get queue statistics
app.get('/api/queue/stats', async (req, res) => {
  try {
    const stats = await queueManager.getQueueStats();
    res.json({
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get queue stats', 
      message: error.message 
    });
  }
});

// Get queue items with filtering and pagination
app.get('/api/queue/items', async (req, res) => {
  try {
    const options = {
      status: req.query.status,
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0,
      orderBy: req.query.orderBy || 'priority',
      orderDirection: req.query.orderDirection?.toUpperCase() || 'ASC'
    };

    const items = await queueManager.getQueueItems(options);
    
    res.json({
      count: items.length,
      items,
      pagination: {
        limit: options.limit,
        offset: options.offset
      }
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get queue items', 
      message: error.message 
    });
  }
});

// Get specific queue item by ID
app.get('/api/queue/items/:queueId', async (req, res) => {
  try {
    const queueItem = await queueManager.getQueueItem(req.params.queueId);
    
    if (!queueItem) {
      return res.status(404).json({ 
        error: 'Queue item not found' 
      });
    }
    
    res.json(queueItem);
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get queue item', 
      message: error.message 
    });
  }
});

// Add media item to queue (for existing media)
app.post('/api/queue/enqueue/:mediaItemId', async (req, res) => {
  try {
    const { mediaItemId } = req.params;
    const maxAttempts = parseInt(req.body.maxAttempts) || 3;

    const queueId = await queueManager.enqueueMediaItem(mediaItemId, maxAttempts);
    
    res.status(201).json({
      success: true,
      message: 'Media item added to queue',
      queueId,
      mediaItemId
    });
  } catch (error) {
    res.status(400).json({ 
      error: 'Failed to enqueue media item', 
      message: error.message 
    });
  }
});

// Cancel a queue item
app.post('/api/queue/items/:queueId/cancel', async (req, res) => {
  try {
    const result = await queueManager.cancelQueueItem(req.params.queueId);
    res.json({
      success: true,
      message: 'Queue item cancelled',
      queueId: result.id
    });
  } catch (error) {
    res.status(400).json({ 
      error: 'Failed to cancel queue item', 
      message: error.message 
    });
  }
});

// Retry a failed queue item
app.post('/api/queue/items/:queueId/retry', async (req, res) => {
  try {
    const result = await queueManager.retryQueueItem(req.params.queueId);
    res.json({
      success: true,
      message: 'Queue item will be retried',
      queueId: result.id
    });
  } catch (error) {
    res.status(400).json({ 
      error: 'Failed to retry queue item', 
      message: error.message 
    });
  }
});

// Get processing worker status
app.get('/api/queue/worker/status', (req, res) => {
  const status = processingWorker.getStatus();
  res.json({
    ...status,
    aiServiceUrl
  });
});

// Start processing worker
app.post('/api/queue/worker/start', (req, res) => {
  if (processingWorker.isRunning()) {
    return res.status(400).json({ 
      error: 'Worker already running' 
    });
  }
  
  processingWorker.start(5000);
  res.json({
    success: true,
    message: 'Processing worker started'
  });
});

// Stop processing worker
app.post('/api/queue/worker/stop', (req, res) => {
  if (!processingWorker.isRunning()) {
    return res.status(400).json({ 
      error: 'Worker not running' 
    });
  }
  
  processingWorker.stop();
  res.json({
    success: true,
    message: 'Processing worker stopped'
  });
});

// ============================================================================
// IMMICH CONNECTOR ENDPOINTS
// ============================================================================

// Middleware to check if Immich connector is initialized
const requireImmichConnector = (req, res, next) => {
  if (!immichConnector) {
    return res.status(503).json({
      error: 'Immich connector not configured',
      message: 'Please set IMMICH_URL and IMMICH_API_KEY environment variables',
    });
  }
  next();
};

// Test Immich connection
app.get('/api/immich/test', requireImmichConnector, async (req, res) => {
  try {
    const result = await immichConnector.testConnection();
    res.json({
      status: 'success',
      message: 'Connection to Immich successful',
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Connection test failed',
      message: error.message,
    });
  }
});

// Get Immich server version
app.get('/api/immich/version', requireImmichConnector, async (req, res) => {
  try {
    const version = await immichConnector.getServerVersion();
    res.json({
      status: 'success',
      data: version,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get server version',
      message: error.message,
    });
  }
});

// Get asset statistics
app.get('/api/immich/statistics', requireImmichConnector, async (req, res) => {
  try {
    const stats = await immichConnector.getAssetStatistics();
    res.json({
      status: 'success',
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get statistics',
      message: error.message,
    });
  }
});

// Get all assets with pagination
app.get('/api/immich/assets', requireImmichConnector, async (req, res) => {
  try {
    const options = {
      size: parseInt(req.query.size) || 100,
      page: parseInt(req.query.page) || 0,
      isFavorite: req.query.isFavorite === 'true' ? true : undefined,
      isArchived: req.query.isArchived === 'true',
    };

    const assets = await immichConnector.getAssets(options);
    res.json({
      status: 'success',
      count: assets.length,
      page: options.page,
      size: options.size,
      data: assets,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch assets',
      message: error.message,
    });
  }
});

// Get all photos
app.get('/api/immich/photos', requireImmichConnector, async (req, res) => {
  try {
    const options = {
      size: parseInt(req.query.size) || 100,
      page: parseInt(req.query.page) || 0,
    };

    const photos = await immichConnector.getPhotos(options);
    res.json({
      status: 'success',
      count: photos.length,
      data: photos,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch photos',
      message: error.message,
    });
  }
});

// Get all videos
app.get('/api/immich/videos', requireImmichConnector, async (req, res) => {
  try {
    const options = {
      size: parseInt(req.query.size) || 100,
      page: parseInt(req.query.page) || 0,
    };

    const videos = await immichConnector.getVideos(options);
    res.json({
      status: 'success',
      count: videos.length,
      data: videos,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch videos',
      message: error.message,
    });
  }
});

// Get specific asset info
app.get('/api/immich/assets/:assetId', requireImmichConnector, async (req, res) => {
  try {
    const assetInfo = await immichConnector.getAssetInfo(req.params.assetId);
    res.json({
      status: 'success',
      data: assetInfo,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch asset info',
      message: error.message,
    });
  }
});

// Get asset thumbnail
app.get('/api/immich/assets/:assetId/thumbnail', requireImmichConnector, async (req, res) => {
  try {
    const options = {
      format: req.query.format || 'JPEG',
      size: req.query.size || 'preview',
    };

    const thumbnail = await immichConnector.getThumbnail(req.params.assetId, options);
    
    // Set appropriate content type
    const contentType = options.format === 'WEBP' ? 'image/webp' : 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.send(thumbnail);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch thumbnail',
      message: error.message,
    });
  }
});

// Download full-resolution file
app.get('/api/immich/assets/:assetId/file', requireImmichConnector, async (req, res) => {
  try {
    const file = await immichConnector.getFullResolutionFile(req.params.assetId);
    
    // Get asset info to set proper content type
    const assetInfo = await immichConnector.getAssetInfo(req.params.assetId);
    
    if (assetInfo.originalMimeType) {
      res.setHeader('Content-Type', assetInfo.originalMimeType);
    }
    if (assetInfo.originalFileName) {
      res.setHeader('Content-Disposition', `attachment; filename="${assetInfo.originalFileName}"`);
    }
    
    res.send(file);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch file',
      message: error.message,
    });
  }
});

// Search assets
app.post('/api/immich/search', requireImmichConnector, async (req, res) => {
  try {
    const searchCriteria = {
      query: req.body.query || '',
      type: req.body.type || 'ALL',
      size: req.body.size || 100,
    };

    const results = await immichConnector.searchAssets(searchCriteria);
    res.json({
      status: 'success',
      count: results.length,
      data: results,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to search assets',
      message: error.message,
    });
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  processingWorker.stop();
  pool.end(() => {
    console.log('Database pool closed');
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend service running on port ${PORT}`);
});
