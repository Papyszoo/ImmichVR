/**
 * User Settings Routes
 * Manages user preferences for depth generation
 */
const express = require('express');
const router = express.Router();
const pool = require('../config/database');

/**
 * GET /api/settings
 * Get current user settings (global settings for now, user_id is NULL)
 */
router.get('/', async (req, res) => {
  try {
    // Get or create global settings
    let result = await pool.query(`
      SELECT 
        id,
        default_depth_model,
        auto_generate_on_enter,
        created_at,
        updated_at
      FROM user_settings
      WHERE user_id IS NULL
    `);
    
    // Create default settings if not exists
    if (result.rows.length === 0) {
      result = await pool.query(`
        INSERT INTO user_settings (user_id, default_depth_model, auto_generate_on_enter)
        VALUES (NULL, 'small', false)
        RETURNING id, default_depth_model, auto_generate_on_enter, created_at, updated_at
      `);
    }
    
    const settings = result.rows[0];
    
    res.json({
      defaultDepthModel: settings.default_depth_model,
      autoGenerateOnEnter: settings.auto_generate_on_enter,
      updatedAt: settings.updated_at,
    });
    
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

/**
 * PUT /api/settings
 * Update user settings
 */
router.put('/', async (req, res) => {
  const { defaultDepthModel, autoGenerateOnEnter } = req.body;
  
  try {
    // Validate model key if provided
    if (defaultDepthModel) {
      const validModels = ['small', 'base', 'large'];
      if (!validModels.includes(defaultDepthModel)) {
        return res.status(400).json({ 
          error: `Invalid model: ${defaultDepthModel}. Must be one of: ${validModels.join(', ')}` 
        });
      }
    }
    
    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (defaultDepthModel !== undefined) {
      updates.push(`default_depth_model = $${paramIndex++}`);
      values.push(defaultDepthModel);
    }
    
    if (autoGenerateOnEnter !== undefined) {
      updates.push(`auto_generate_on_enter = $${paramIndex++}`);
      values.push(autoGenerateOnEnter);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No settings provided to update' });
    }
    
    // 1. Try to UPDATE existing global settings (user_id IS NULL)
    const updateResult = await pool.query(`
      UPDATE user_settings 
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE user_id IS NULL
      RETURNING id, default_depth_model, auto_generate_on_enter, updated_at
    `, values);
    
    let settings;
    
    if (updateResult.rows.length > 0) {
      settings = updateResult.rows[0];
    } else {
      // 2. If no row exists, INSERT new one
      const insertResult = await pool.query(`
        INSERT INTO user_settings (user_id, default_depth_model, auto_generate_on_enter)
        VALUES (NULL, $1, $2)
        RETURNING id, default_depth_model, auto_generate_on_enter, updated_at
      `, [
        defaultDepthModel || 'small',
        autoGenerateOnEnter !== undefined ? autoGenerateOnEnter : false
      ]);
      settings = insertResult.rows[0];
    }
    
    res.json({
      success: true,
      defaultDepthModel: settings.default_depth_model,
      autoGenerateOnEnter: settings.auto_generate_on_enter,
      updatedAt: settings.updated_at,
    });
    
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

/**
 * GET /api/settings/models
 * Get all AI models with their download status
 */
router.get('/models', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        model_key,
        status,
        name,
        params,
        memory,
        description,
        huggingface_id,
        download_progress,
        file_size_bytes,
        downloaded_at
      FROM ai_models
      ORDER BY 
        CASE model_key 
          WHEN 'small' THEN 1 
          WHEN 'base' THEN 2 
          WHEN 'large' THEN 3 
          ELSE 4
        END
    `);
    
    const models = result.rows.map(row => ({
      key: row.model_key,
      status: row.status,
      name: row.name,
      params: row.params,
      memory: row.memory,
      description: row.description,
      huggingfaceId: row.huggingface_id,
      downloadProgress: row.download_progress,
      fileSizeBytes: row.file_size_bytes,
      downloadedAt: row.downloaded_at,
    }));
    
    res.json({ models });
    
  } catch (error) {
    console.error('Error fetching model status:', error);
    res.status(500).json({ error: 'Failed to fetch model status' });
  }
});

/**
 * POST /api/settings/models/sync
 * Sync database status with actual disk status from AI service
 */
router.post('/models/sync', async (req, res) => {
  try {
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://ai:5000';
    
    // Get status from AI service
    const response = await fetch(`${aiServiceUrl}/api/models/current`);
    if (!response.ok) throw new Error(`AI Service returned ${response.status}`);
    
    const aiStatus = await response.json();
    const downloadedModels = aiStatus.downloaded_models || [];
    
    if (downloadedModels.length > 0) {
      // Mark these as downloaded
      await pool.query(`
        UPDATE ai_models 
        SET status = 'downloaded', downloaded_at = COALESCE(downloaded_at, NOW())
        WHERE model_key = ANY($1)
      `, [downloadedModels]);
    }
    
    // Mark others as not_downloaded (optional, but safer to trust disk)
    // Be careful not to mark 'downloading' as 'not_downloaded' if we are actively downloading?
    // For now, let's just mark verified ones.
    
    res.json({ 
      success: true, 
      synced: downloadedModels 
    });
    
  } catch (error) {
    console.error('Sync failed:', error);
    res.status(500).json({ error: 'Sync failed', message: error.message });
  }
});

/**
 * GET /api/settings/models/ai
 * Get AI service model status (what's actually loaded)
 */
router.get('/models/ai', async (req, res) => {
  try {
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://ai:5000';
    const response = await fetch(`${aiServiceUrl}/api/models`);
    
    if (!response.ok) {
      throw new Error(`AI service returned ${response.status}`);
    }
    
    const data = await response.json();
    res.json(data);
    
  } catch (error) {
    console.error('Error fetching AI models:', error);
    res.status(500).json({ error: 'Failed to fetch AI models' });
  }
});

/**
 * POST /api/settings/models/:key/load
 * Load a model on AI service (downloads if not cached) and update database
 */
router.post('/models/:key/load', async (req, res) => {
  const { key } = req.params;
  
  try {
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://ai:5000';
    
    // Call AI service to load the model
    const response = await fetch(`${aiServiceUrl}/api/models/${key}/load`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `AI service returned ${response.status}`);
    }
    
    const aiResult = await response.json();
    
    // Update database to mark as downloaded
    await pool.query(`
      UPDATE ai_models
      SET status = 'downloaded', downloaded_at = NOW()
      WHERE model_key = $1
    `, [key]);
    
    res.json({
      success: true,
      message: `Model '${key}' loaded successfully`,
      currentModel: aiResult.current_model,
    });
    
  } catch (error) {
    console.error('Error loading model:', error);
    res.status(500).json({ error: 'Failed to load model', message: error.message });
  }
});

/**
 * POST /api/settings/models/:key/download
 * Mark a model as downloaded (legacy - use /load instead)
 */
router.post('/models/:key/download', async (req, res) => {
  const { key } = req.params;
  
  try {
    const result = await pool.query(`
      UPDATE ai_models
      SET status = 'downloaded', downloaded_at = NOW()
      WHERE model_key = $1
      RETURNING model_key, status, downloaded_at
    `, [key]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: `Model ${key} not found` });
    }
    
    res.json({
      success: true,
      model: result.rows[0],
    });
    
  } catch (error) {
    console.error('Error updating model status:', error);
    res.status(500).json({ error: 'Failed to update model status' });
  }
});

/**
 * DELETE /api/settings/models/:key
 * Mark a model as not downloaded
 */
router.delete('/models/:key', async (req, res) => {
  const { key } = req.params;
  
  try {
    const result = await pool.query(`
      UPDATE ai_models
      SET status = 'not_downloaded', downloaded_at = NULL
      WHERE model_key = $1
      RETURNING model_key, status
    `, [key]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: `Model ${key} not found` });
    }

    try {
      const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://ai:5000';
      await fetch(`${aiServiceUrl}/api/models/${key}`, { method: 'DELETE' });
    } catch (e) {
      console.warn('Failed to delete from AI service:', e);
    }
    
    res.json({
      success: true,
      model: result.rows[0],
    });
    
  } catch (error) {
    console.error('Error updating model status:', error);
    res.status(500).json({ error: 'Failed to update model status' });
  }
});

module.exports = router;
