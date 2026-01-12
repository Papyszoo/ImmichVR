const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const upload = require('../middleware/upload');
const { queueManager } = require('../services');

// Get media processing status
router.get('/status', async (req, res) => {
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

// Upload media and add to processing queue
router.post('/upload', upload.single('media'), async (req, res) => {
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

module.exports = router;
