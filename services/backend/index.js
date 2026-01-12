const express = require('express');
const { Pool } = require('pg');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const ImmichConnector = require('./immichConnector');
const QueueManager = require('./queueManager');
const APIGateway = require('./apiGateway');
const ProcessingWorker = require('./processingWorker');
const fileUtils = require('./fileUtils');

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
  console.error('Failed to create upload directory - file uploads will fail:', err.message);
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

// Note: For production deployments, consider adding rate limiting middleware
// such as 'express-rate-limit' to prevent abuse of API endpoints,
// especially for file uploads and queue operations.

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
    console.error('Error fetching photos:', error);
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
  console.log(`Fetching thumbnail for asset: ${req.params.assetId}`);
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
    console.error(`Error fetching thumbnail for ${req.params.assetId}:`, error);
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

// Generate depth map for an Immich asset (with caching)
app.post('/api/immich/assets/:assetId/depth', requireImmichConnector, async (req, res) => {
  const { assetId } = req.params;
  console.log(`Generating depth map for Immich asset: ${assetId}`);
  
  try {
    // First, check if we have a cached depth map for this Immich asset
    const cacheResult = await pool.query(
      `SELECT dmc.file_path, dmc.file_size
       FROM depth_map_cache dmc
       JOIN media_items mi ON mi.id = dmc.media_item_id
       WHERE mi.immich_asset_id = $1 AND dmc.version_type = 'thumbnail'`,
      [assetId]
    );
    
    if (cacheResult.rows.length > 0) {
      // Return cached depth map
      const cachedPath = cacheResult.rows[0].file_path;
      console.log(`Returning cached depth map for ${assetId}: ${cachedPath}`);
      
      try {
        const cachedBuffer = await fs.readFile(cachedPath);
        
        // Update access stats
        await pool.query(
          `UPDATE depth_map_cache dmc
           SET accessed_at = NOW(), access_count = access_count + 1
           FROM media_items mi
           WHERE mi.id = dmc.media_item_id 
             AND mi.immich_asset_id = $1 
             AND dmc.version_type = 'thumbnail'`,
          [assetId]
        );
        
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('X-Depth-Cache', 'hit');
        return res.send(cachedBuffer);
      } catch (readError) {
        console.warn(`Cached file not readable, regenerating: ${readError.message}`);
        // Continue to regenerate
      }
    }
    
    console.log(`No cache found for ${assetId}, generating new depth map...`);
    
    // Fetch the thumbnail image from Immich (faster than full resolution)
    const imageBuffer = await immichConnector.getThumbnail(assetId, { size: 'preview', format: 'JPEG' });
    console.log(`Fetched thumbnail, size: ${imageBuffer.length} bytes`);
    
    // Get asset info for filename
    const assetInfo = await immichConnector.getAssetInfo(assetId);
    
    // Send to AI service for depth processing
    const FormData = require('form-data');
    const axios = require('axios');
    
    const formData = new FormData();
    formData.append('image', imageBuffer, {
      filename: assetInfo.originalFileName || 'image.jpg',
      contentType: 'image/jpeg'
    });
    
    const aiUrl = process.env.AI_SERVICE_URL || 'http://ai:5000';
    console.log(`Sending to AI at ${aiUrl}/api/depth`);
    
    const aiResponse = await axios.post(`${aiUrl}/api/depth`, formData, {
      headers: formData.getHeaders(),
      responseType: 'arraybuffer',
      timeout: 120000, // 2 minutes
    });
    
    const depthBuffer = Buffer.from(aiResponse.data);
    console.log(`Generated depth map for ${assetId}, size: ${depthBuffer.length} bytes`);
    
    // Save to cache (in background, don't block response)
    (async () => {
      try {
        // Create or get media item for this Immich asset
        let mediaItemId;
        const existingMedia = await pool.query(
          'SELECT id FROM media_items WHERE immich_asset_id = $1',
          [assetId]
        );
        
        if (existingMedia.rows.length > 0) {
          mediaItemId = existingMedia.rows[0].id;
        } else {
          // Create a minimal media item record for caching
          const insertResult = await pool.query(
            `INSERT INTO media_items 
             (original_filename, media_type, immich_asset_id, source_type)
             VALUES ($1, 'photo', $2, 'immich')
             RETURNING id`,
            [assetInfo.originalFileName || `immich_${assetId}`, assetId]
          );
          mediaItemId = insertResult.rows[0].id;
        }
        
        // Save depth map to disk
        const depthMapsDir = process.env.DEPTH_MAPS_DIR || '/data/depth_maps';
        await fs.mkdir(depthMapsDir, { recursive: true });
        
        const baseFilename = path.parse(assetInfo.originalFileName || `immich_${assetId}`).name;
        const depthFilename = `${baseFilename}_${mediaItemId}_immich_depth.png`;
        const depthFilePath = path.join(depthMapsDir, depthFilename);
        
        await fs.writeFile(depthFilePath, depthBuffer);
        console.log(`Cached depth map saved to: ${depthFilePath}`);
        
        // Store metadata in database
        await pool.query(
          `INSERT INTO depth_map_cache 
           (media_item_id, file_path, file_size, format, width, height, model_name, model_version, version_type)
           VALUES ($1, $2, $3, 'png', 0, 0, 'Depth-Anything-V2', 'small', 'thumbnail')
           ON CONFLICT (media_item_id, version_type) 
           DO UPDATE SET 
             file_path = EXCLUDED.file_path,
             file_size = EXCLUDED.file_size,
             generated_at = NOW(),
             accessed_at = NOW(),
             access_count = 0`,
          [mediaItemId, depthFilePath, depthBuffer.length]
        );
        console.log(`Depth map metadata stored for media_item_id=${mediaItemId}`);
      } catch (cacheError) {
        console.error(`Failed to cache depth map for ${assetId}:`, cacheError.message);
        // Don't throw - caching failure shouldn't break the response
      }
    })();
    
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('X-Depth-Cache', 'miss');
    res.send(depthBuffer);
  } catch (error) {
    console.error(`Error generating depth for ${assetId}:`, error.message);
    if (error.response) {
      console.error(`AI response status: ${error.response.status}`);
      console.error(`AI response data:`, error.response.data?.toString?.() || error.response.data);
    }
    res.status(500).json({
      error: 'Failed to generate depth map',
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

// Import media from Immich (fetch both thumbnail and full-resolution)
app.post('/api/immich/import/:assetId', requireImmichConnector, async (req, res) => {
  const { assetId } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get asset info from Immich
    const assetInfo = await immichConnector.getAssetInfo(assetId);

    // Determine media type
    let mediaType = 'photo';
    if (assetInfo.type === 'VIDEO') {
      mediaType = 'video';
    }

    // Check if already imported
    const existingMedia = await client.query(
      'SELECT id FROM media_items WHERE immich_asset_id = $1',
      [assetId]
    );

    if (existingMedia.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Asset already imported',
        mediaItemId: existingMedia.rows[0].id,
      });
    }

    // Fetch both thumbnail and full-resolution files
    console.log(`Fetching thumbnail and full-resolution for Immich asset ${assetId}`);
    
    // Determine thumbnail format based on original mime type
    const thumbnailFormat = fileUtils.getThumbnailFormat(assetInfo.originalMimeType);
    
    let thumbnailBuffer;
    try {
      thumbnailBuffer = await immichConnector.getThumbnail(assetId, { 
        format: thumbnailFormat, 
        size: 'preview' 
      });
    } catch (thumbnailError) {
      throw new Error(`Failed to fetch thumbnail in ${thumbnailFormat} format: ${thumbnailError.message}`);
    }
    
    const fullResBuffer = await immichConnector.getFullResolutionFile(assetId);

    // Save files to disk
    await fs.mkdir(uploadDir, { recursive: true });
    
    const baseFilename = assetInfo.originalFileName || `immich_${assetId}`;
    const safeName = fileUtils.sanitizeFilename(baseFilename);
    
    // Use appropriate extensions for files
    const thumbnailExt = fileUtils.getExtensionForFormat(thumbnailFormat);
    const baseNameWithoutExt = fileUtils.getBaseFilename(safeName);
    const originalExt = fileUtils.getExtension(safeName);
    
    const thumbnailPath = path.join(uploadDir, `${baseNameWithoutExt}_thumbnail${thumbnailExt}`);
    const fullResPath = path.join(uploadDir, `${baseNameWithoutExt}${originalExt}`);
    
    await fs.writeFile(thumbnailPath, thumbnailBuffer);
    await fs.writeFile(fullResPath, fullResBuffer);

    // Insert media item with both paths
    const mediaResult = await client.query(
      `INSERT INTO media_items 
       (original_filename, media_type, file_path, thumbnail_path, file_size, mime_type, 
        immich_asset_id, source_type, captured_at, width, height)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'immich', $8, $9, $10)
       RETURNING id`,
      [
        assetInfo.originalFileName || safeName,
        mediaType,
        fullResPath,
        thumbnailPath,
        fullResBuffer.length,
        assetInfo.originalMimeType || 'image/jpeg',
        assetId,
        assetInfo.fileCreatedAt || null,
        assetInfo.exifInfo?.exifImageWidth || null,
        assetInfo.exifInfo?.exifImageHeight || null,
      ]
    );

    const mediaItemId = mediaResult.rows[0].id;

    // Add to processing queue
    const queueId = await queueManager.enqueueMediaItem(mediaItemId);

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Media imported from Immich and queued for processing',
      mediaItemId,
      queueId,
      assetId,
      filename: assetInfo.originalFileName,
      thumbnailSize: thumbnailBuffer.length,
      fullResSize: fullResBuffer.length,
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Immich import error:', error);
    res.status(500).json({
      error: 'Failed to import from Immich',
      message: error.message,
    });
  } finally {
    client.release();
  }
});

// ============================================================================
// DEPTH MAP RETRIEVAL ENDPOINTS
// ============================================================================

// Get depth map for a media item (by version type)
app.get('/api/media/:mediaItemId/depth', async (req, res) => {
  try {
    const { mediaItemId } = req.params;
    const versionType = req.query.version || 'full_resolution'; // 'thumbnail' or 'full_resolution'

    // Validate version type
    if (!['thumbnail', 'full_resolution'].includes(versionType)) {
      return res.status(400).json({
        error: 'Invalid version type',
        message: 'Version must be "thumbnail" or "full_resolution"',
      });
    }

    // Get depth map from cache
    const result = await pool.query(
      `SELECT file_path, file_size, format, model_name, model_version, generated_at
       FROM depth_map_cache
       WHERE media_item_id = $1 AND version_type = $2`,
      [mediaItemId, versionType]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Depth map not found',
        message: `No ${versionType} depth map available for this media item`,
      });
    }

    const depthMap = result.rows[0];

    // Update access stats
    await pool.query(
      `UPDATE depth_map_cache
       SET accessed_at = NOW(), access_count = access_count + 1
       WHERE media_item_id = $1 AND version_type = $2`,
      [mediaItemId, versionType]
    );

    // Read and send the depth map file
    const depthMapBuffer = await fs.readFile(depthMap.file_path);
    
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('X-Depth-Map-Version', versionType);
    res.setHeader('X-Model-Name', depthMap.model_name || 'unknown');
    res.setHeader('X-Model-Version', depthMap.model_version || 'unknown');
    res.setHeader('X-Generated-At', depthMap.generated_at?.toISOString() || 'unknown');
    res.send(depthMapBuffer);

  } catch (error) {
    console.error('Error fetching depth map:', error);
    res.status(500).json({
      error: 'Failed to fetch depth map',
      message: error.message,
    });
  }
});

// Get depth map metadata (without file content)
app.get('/api/media/:mediaItemId/depth/info', async (req, res) => {
  try {
    const { mediaItemId } = req.params;

    // Get all depth maps for this media item
    const result = await pool.query(
      `SELECT version_type, file_size, format, width, height, 
              model_name, model_version, generated_at, access_count
       FROM depth_map_cache
       WHERE media_item_id = $1
       ORDER BY version_type`,
      [mediaItemId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'No depth maps found',
        message: 'No depth maps available for this media item',
      });
    }

    res.json({
      mediaItemId,
      depthMaps: result.rows,
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch depth map info',
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
