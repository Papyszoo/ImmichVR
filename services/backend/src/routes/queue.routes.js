const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { queueManager, processingWorker } = require('../services');
const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://ai:5000';

// Get processing queue summary
router.get('/summary', async (req, res) => {
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

// Get queue statistics
router.get('/stats', async (req, res) => {
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
router.get('/items', async (req, res) => {
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
router.get('/items/:queueId', async (req, res) => {
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
router.post('/enqueue/:mediaItemId', async (req, res) => {
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
router.post('/items/:queueId/cancel', async (req, res) => {
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
router.post('/items/:queueId/retry', async (req, res) => {
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
router.get('/worker/status', (req, res) => {
  const status = processingWorker.getStatus();
  res.json({
    ...status,
    aiServiceUrl
  });
});

// Start processing worker
router.post('/worker/start', (req, res) => {
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
router.post('/worker/stop', (req, res) => {
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

module.exports = router;
