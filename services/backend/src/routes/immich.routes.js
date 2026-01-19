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

// Generate depth map - DEPRECATED (Moved to /api/assets/:id/generate)
// This route is kept as a redirect stub or can be removed entirely.
// For now, we remove the logic to force use of the new endpoint.
router.post('/assets/:assetId/depth', async (req, res) => {
  res.status(301).json({ 
    error: 'Deprecated', 
    message: 'Please use POST /api/assets/:id/generate' 
  });
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

// Get timeline buckets
router.get('/timeline', async (req, res) => {
  try {
    const buckets = await immichConnector.getTimeBuckets();
    res.json({
      status: 'success',
      data: buckets,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch timeline',
      message: error.message,
    });
  }
});

// Get assets for a specific timeline bucket
router.get('/timeline/:bucket', async (req, res) => {
  try {
    // Decode the bucket identifier (it might have special chars or time format)
    const bucket = decodeURIComponent(req.params.bucket);
    const assets = await immichConnector.getTimelineBucket(bucket);
    
    // Filter to only include IMAGE/VIDEO if needed (ImmichConnector might return both)
    // For now returning all, frontend can filter
    
    res.json({
      status: 'success',
      count: assets.length,
      data: assets,
    });
  } catch (error) {
    res.status(500).json({
      error: `Failed to fetch bucket ${req.params.bucket}`,
      message: error.message,
    });
  }
});

module.exports = router;
