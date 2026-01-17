/**
 * Assets Routes
 * Manages generic 3D assets (depth maps, splats)
 * Consolidated endpoint for generating, listing, and deleting assets.
 */
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const fs = require('fs').promises;
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');
const { immichConnector, modelManager } = require('../services');

/**
 * GET /api/assets/:id/files
 * List all generated files for a specific photo (media_item_id or immich_asset_id)
 */
router.get('/:id/files', async (req, res) => {
  const { id } = req.params;
  
  try {
    // Resolve ID: If it's a UUID, it's likely our internal media_item_id. 
    // If it's just a string/UUID that doesn't match, check if it's an immich asset id.
    // For now, we assume the frontend sends the Immich Asset ID as 'id' usually.
    // So we need to find the internal media_item_id first.
    
    let mediaItemId;
    
    // Check if it's already a media_item uuid
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (uuidRegex.test(id)) {
        // Check if it exists in media_items
        const check = await pool.query('SELECT id FROM media_items WHERE id = $1', [id]);
        if (check.rows.length > 0) {
            mediaItemId = id;
        }
    }
    
    // If not found yet, lookup via immich_asset_id
    if (!mediaItemId) {
        const lookup = await pool.query('SELECT id FROM media_items WHERE immich_asset_id = $1', [id]);
        if (lookup.rows.length > 0) {
            mediaItemId = lookup.rows[0].id;
        } else {
            // No local record yet - means no assets generated yet
            return res.json({ photoId: id, files: [], count: 0 });
        }
    }

    // Get all 3D assets for this photo
    const result = await pool.query(`
      SELECT 
        id,
        asset_type,
        model_key,
        format,
        file_path,
        file_size,
        width,
        height,
        metadata,
        generated_at
      FROM generated_assets_3d
      WHERE media_item_id = $1
      ORDER BY generated_at DESC
    `, [mediaItemId]);
    
    const files = result.rows.map(row => ({
      id: row.id,
      type: row.asset_type,
      modelKey: row.model_key,
      format: row.format,
      filePath: row.file_path,
      fileSize: row.file_size,
      width: row.width,
      height: row.height,
      metadata: row.metadata,
      generatedAt: row.generated_at,
    }));
    
    res.json({
      photoId: id,
      files,
      count: files.length,
    });
    
  } catch (error) {
    console.error('Error fetching generic asset files:', error);
    res.status(500).json({ error: 'Failed to fetch asset files' });
  }
});

/**
 * POST /api/assets/:id/generate
 * Generate a new 3D asset (Depth, Splat, etc)
 * Replaces POST /api/immich/assets/:assetId/depth
 */
router.post('/:id/generate', async (req, res) => {
    const { id } = req.params;
    const { type = 'depth', modelKey = 'small' } = req.body; // Default to depth/small
    
    console.log(`Generating generic asset for ${id}: Type=${type}, Model=${modelKey}`);

    try {
        if (type === 'depth') {
            await handleDepthGeneration(id, modelKey, res);
        } else {
            res.status(501).json({ error: 'Not implemented', message: `Generation for type '${type}' not yet supported` });
        }
    } catch (error) {
        console.error(`Error generating asset for ${id}:`, error.message);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to generate asset', message: error.message });
        }
    }
});

/**
 * GET /api/assets/:id/files/:fileId/download
 * Download a specific generated file (depth map, etc.)
 */
router.get('/:id/files/:fileId/download', async (req, res) => {
  const { id, fileId } = req.params;
  
  try {
    // Get file info
    const fileResult = await pool.query(`
      SELECT id, file_path, format, asset_type FROM generated_assets_3d
      WHERE id = $1
    `, [fileId]);
    
    if (fileResult.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const filePath = fileResult.rows[0].file_path;
    const format = fileResult.rows[0].format;
    
    // Determine content type
    const contentTypes = {
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'ply': 'application/octet-stream',
      'splat': 'application/octet-stream',
      'ksplat': 'application/octet-stream',
    };
    const contentType = contentTypes[format] || 'application/octet-stream';
    
    // Read and send file
    const fileBuffer = await fs.readFile(filePath);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(filePath)}"`);
    res.send(fileBuffer);
    
  } catch (error) {
    console.error('Error downloading generated file:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

/**
 * DELETE /api/assets/:id/files/:fileId
 * Delete a specific generated file
 */
router.delete('/:id/files/:fileId', async (req, res) => {
  const { id, fileId } = req.params;
  
  try {
    // Get file info first
    const fileResult = await pool.query(`
      SELECT id, file_path, model_key, asset_type FROM generated_assets_3d
      WHERE id = $1
    `, [fileId]);
    
    if (fileResult.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const filePath = fileResult.rows[0].file_path;
    const modelKey = fileResult.rows[0].model_key;
    const assetType = fileResult.rows[0].asset_type;
    
    // Delete from database
    await pool.query('DELETE FROM generated_assets_3d WHERE id = $1', [fileId]);
    
    // Delete physical file if it exists
    try {
      await fs.unlink(filePath);
    } catch (err) {
      console.warn(`Could not delete file ${filePath}:`, err.message);
    }
    
    res.json({
      success: true,
      message: `Deleted ${modelKey} ${assetType}`,
      deletedFileId: fileId,
    });
    
  } catch (error) {
    console.error('Error deleting generated file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});



// --- Helper Functions ---

async function handleDepthGeneration(assetId, modelKey, res) {
    // 1. Check Cache
    // We need to resolve to media_item_id to check cache in DB
    const mediaItemResult = await pool.query('SELECT id FROM media_items WHERE immich_asset_id = $1', [assetId]);
    
    if (mediaItemResult.rows.length > 0) {
        const mediaItemId = mediaItemResult.rows[0].id;
        const cacheResult = await pool.query(
            `SELECT file_path FROM generated_assets_3d 
             WHERE media_item_id = $1 AND asset_type = 'depth' AND model_key = $2`,
            [mediaItemId, modelKey]
        );
        
        if (cacheResult.rows.length > 0) {
            const cachedPath = cacheResult.rows[0].file_path;
             try {
                const cachedBuffer = await fs.readFile(cachedPath);
                res.setHeader('Content-Type', 'image/png');
                res.setHeader('X-Asset-Cache', 'hit');
                return res.send(cachedBuffer);
            } catch (err) {
                console.warn(`Cache file missing at ${cachedPath}, regenerating...`);
            }
        }
    }

    // 2. Fetch Source Image
    const imageBuffer = await immichConnector.getThumbnail(assetId, { size: 'preview', format: 'JPEG' });
    const assetInfo = await immichConnector.getAssetInfo(assetId);

    // 3. Prepare AI Request
    const formData = new FormData();
    formData.append('image', imageBuffer, {
        filename: assetInfo.originalFileName || 'image.jpg',
        contentType: 'image/jpeg'
    });
    
    const aiUrl = process.env.AI_SERVICE_URL || 'http://ai:5000';
    
    // 4. Ensure Model Loaded
    if (modelManager) {
        await modelManager.ensureModelLoaded(modelKey, 'manual');
    }

    // 5. Call AI Service
    const aiResponse = await axios.post(`${aiUrl}/api/depth?model=${modelKey}`, formData, {
        headers: formData.getHeaders(),
        responseType: 'arraybuffer',
        timeout: 120000, 
    });

    if (modelManager) await modelManager.registerActivity('manual');

    // 6. Save & Cache
    const depthBuffer = Buffer.from(aiResponse.data);
    
    // Background Save
    (async () => {
        try {
            let mediaItemId;
            if (mediaItemResult.rows.length > 0) {
                mediaItemId = mediaItemResult.rows[0].id;
            } else {
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

            const depthMapsDir = process.env.DEPTH_MAPS_DIR || '/data/depth_maps';
            await fs.mkdir(depthMapsDir, { recursive: true });
            
            const baseFilename = path.parse(assetInfo.originalFileName || `immich_${assetId}`).name;
            const depthFilename = `${baseFilename}_${mediaItemId}_${modelKey}_depth.png`;
            const depthFilePath = path.join(depthMapsDir, depthFilename);
            
            await fs.writeFile(depthFilePath, depthBuffer);
            
            await pool.query(
              `INSERT INTO generated_assets_3d 
               (media_item_id, asset_type, model_key, format, file_path, file_size, width, height, metadata)
               VALUES ($1, 'depth', $2, 'png', $3, $4, 0, 0, $5)
               ON CONFLICT (media_item_id, asset_type, model_key, format) 
               DO UPDATE SET 
                 file_path = EXCLUDED.file_path,
                 file_size = EXCLUDED.file_size,
                 generated_at = NOW()`,
              [mediaItemId, modelKey, depthFilePath, depthBuffer.length, JSON.stringify({ model_name: `Depth-Anything-${modelKey}` })]
            );
        } catch (e) {
            console.error('Background cache save failed:', e);
        }
    })();

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('X-Asset-Cache', 'miss');
    res.send(depthBuffer);
}

module.exports = router;
