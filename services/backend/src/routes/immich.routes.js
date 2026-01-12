const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const FormData = require('form-data');
const axios = require('axios');
const pool = require('../config/database');
const { immichConnector } = require('../services');
const requireImmichConnector = require('../middleware/immichAuth');

// Apply middleware to all routes in this router
router.use(requireImmichConnector);

// Test Immich connection
router.get('/test', async (req, res) => {
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
router.get('/version', async (req, res) => {
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
router.get('/statistics', async (req, res) => {
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
router.get('/assets', async (req, res) => {
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
router.get('/photos', async (req, res) => {
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
router.get('/videos', async (req, res) => {
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
router.get('/assets/:assetId', async (req, res) => {
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
router.get('/assets/:assetId/thumbnail', async (req, res) => {
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
router.get('/assets/:assetId/file', async (req, res) => {
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
router.post('/assets/:assetId/depth', async (req, res) => {
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
             (original_filename, media_type, immich_asset_id, source_type, file_path, file_size, mime_type)
             VALUES ($1, 'photo', $2, 'immich', $3, $4, $5)
             RETURNING id`,
            [
              assetInfo.originalFileName || `immich_${assetId}`, 
              assetId,
              `immich://${assetId}`,
              assetInfo.exifInfo?.fileSizeInByte || 0,
              assetInfo.originalMimeType || 'application/octet-stream'
            ]
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
router.post('/search', async (req, res) => {
  try {
    const searchCriteria = {
      query: req.body.query || '',
      type: req.body.type || 'ALL',
      size: req.body.size || 100,
    };
    
    // Not implemented in ImmichConnector yet
    // const results = await immichConnector.searchAssets(searchCriteria);
    
    res.status(501).json({ 
      error: 'Not implemented', 
      message: 'Search function is not yet implemented' 
    });
  } catch (error) {
    res.status(500).json({
      error: 'Search failed',
      message: error.message,
    });
  }
});

module.exports = router;
