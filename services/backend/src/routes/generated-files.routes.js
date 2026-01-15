/**
 * Generated Files Routes
 * Manages generated files (depth maps, future splats) for photos
 */
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const fs = require('fs').promises;
const path = require('path');

/**
 * GET /api/photos/:id/files
 * List all generated files for a specific photo
 */
router.get('/:id/files', async (req, res) => {
  const { id } = req.params;
  
  try {
    // Get all depth maps for this photo
    const result = await pool.query(`
      SELECT 
        id,
        file_path,
        file_size,
        model_key,
        model_name,
        version_type,
        width,
        height,
        generated_at
      FROM depth_map_cache
      WHERE media_item_id = $1
      ORDER BY generated_at DESC
    `, [id]);
    
    const files = result.rows.map(row => ({
      id: row.id,
      type: 'depth',
      modelKey: row.model_key,
      modelName: row.model_name,
      versionType: row.version_type,
      filePath: row.file_path,
      fileSize: row.file_size,
      width: row.width,
      height: row.height,
      generatedAt: row.generated_at,
    }));
    
    res.json({
      photoId: id,
      files,
      count: files.length,
    });
    
  } catch (error) {
    console.error('Error fetching generated files:', error);
    res.status(500).json({ error: 'Failed to fetch generated files' });
  }
});

/**
 * DELETE /api/photos/:id/files/:fileId
 * Delete a specific generated file
 */
router.delete('/:id/files/:fileId', async (req, res) => {
  const { id, fileId } = req.params;
  
  try {
    // Get file info first
    const fileResult = await pool.query(`
      SELECT id, file_path, model_key FROM depth_map_cache
      WHERE id = $1 AND media_item_id = $2
    `, [fileId, id]);
    
    if (fileResult.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const filePath = fileResult.rows[0].file_path;
    const modelKey = fileResult.rows[0].model_key;
    
    // Delete from database
    await pool.query('DELETE FROM depth_map_cache WHERE id = $1', [fileId]);
    
    // Delete physical file if it exists
    try {
      await fs.unlink(filePath);
    } catch (err) {
      // File might not exist, that's okay
      console.warn(`Could not delete file ${filePath}:`, err.message);
    }
    
    res.json({
      success: true,
      message: `Deleted ${modelKey} depth map`,
      deletedFileId: fileId,
    });
    
  } catch (error) {
    console.error('Error deleting generated file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

/**
 * GET /api/photos/:id/files/available-models
 * Get list of models that can generate for this photo
 * (models that are downloaded but haven't generated for this photo yet)
 */
router.get('/:id/files/available-models', async (req, res) => {
  const { id } = req.params;
  
  try {
    // Get downloaded models
    const modelsResult = await pool.query(`
      SELECT model_key FROM ai_models WHERE status = 'downloaded'
    `);
    const downloadedModels = modelsResult.rows.map(r => r.model_key);
    
    // Get models that already have depth for this photo
    const existingResult = await pool.query(`
      SELECT DISTINCT model_key FROM depth_map_cache
      WHERE media_item_id = $1
    `, [id]);
    const existingModels = existingResult.rows.map(r => r.model_key);
    
    // Available = downloaded but not yet generated
    const availableModels = downloadedModels.filter(m => !existingModels.includes(m));
    
    res.json({
      photoId: id,
      downloadedModels,
      existingModels,
      availableModels,
    });
    
  } catch (error) {
    console.error('Error fetching available models:', error);
    res.status(500).json({ error: 'Failed to fetch available models' });
  }
});

module.exports = router;
