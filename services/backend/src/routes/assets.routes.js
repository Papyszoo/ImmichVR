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
const { spawn } = require('child_process');
const { immichConnector, modelManager } = require('../services');

// Splat storage directory
const SPLATS_DIR = process.env.SPLATS_DIR || '/app/data/splats';

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
        } else if (type === 'splat') {
            await handleSplatGeneration(id, res);
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

/**
 * POST /api/assets/:id/convert
 * Convert PLY to KSPLAT format
 */
router.post('/:id/convert', async (req, res) => {
  const { id } = req.params;
  const { from = 'ply', to = 'ksplat' } = req.body;
  
  console.log(`[Convert] Converting ${from} to ${to} for ${id}...`);
  
  try {
    // Find the media_item_id
    let mediaItemId;
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    
    if (uuidRegex.test(id)) {
      const check = await pool.query('SELECT id FROM media_items WHERE id = $1', [id]);
      if (check.rows.length > 0) {
        mediaItemId = check.rows[0].id;
      }
    }
    
    if (!mediaItemId) {
      const lookup = await pool.query('SELECT id FROM media_items WHERE immich_asset_id = $1', [id]);
      if (lookup.rows.length > 0) {
        mediaItemId = lookup.rows[0].id;
      } else {
        return res.status(404).json({ error: 'Photo not found' });
      }
    }
    
    // Find PLY file
    const plyResult = await pool.query(`
      SELECT id, file_path, model_key FROM generated_assets_3d
      WHERE media_item_id = $1 AND format = 'ply' AND asset_type = 'splat'
    `, [mediaItemId]);
    
    if (plyResult.rows.length === 0) {
      return res.status(404).json({ error: 'No PLY file found to convert' });
    }
    
    const plyFile = plyResult.rows[0];
    const plyFilePath = plyFile.file_path;
    const modelKey = plyFile.model_key;
    
    // Check if target format already exists
    const existingCheck = await pool.query(`
      SELECT id FROM generated_assets_3d
      WHERE media_item_id = $1 AND format = $2 AND asset_type = 'splat'
    `, [mediaItemId, to]);
    
    if (existingCheck.rows.length > 0) {
      return res.json({ 
        success: true, 
        message: `${to.toUpperCase()} already exists`,
        status: 'already_converted'
      });
    }
    
    // Trigger conversion based on target format
    try {
      let outputPath;
      if (to === 'splat') {
        outputPath = await convertPlyToSplat(plyFilePath, mediaItemId, modelKey);
      } else {
        // Default to ksplat
        outputPath = await convertPlyToKsplat(plyFilePath, mediaItemId, modelKey);
      }
      res.json({ 
        success: true, 
        message: 'Conversion complete',
        status: 'converted',
        format: to,
        outputPath 
      });
    } catch (convErr) {
      console.error('[Convert] Conversion failed:', convErr.message);
      res.status(500).json({ 
        error: 'Conversion failed', 
        message: convErr.message 
      });
    }
    
  } catch (error) {
    console.error('Error in conversion:', error);
    res.status(500).json({ error: 'Failed to convert file' });
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

/**
 * Handle Gaussian Splat generation via AI service
 * Generates .ply from AI service, then converts to .ksplat for Quest 3
 */
async function handleSplatGeneration(assetId, res) {
    const modelKey = 'sharp';
    
    // 1. Check Cache
    const mediaItemResult = await pool.query('SELECT id FROM media_items WHERE immich_asset_id = $1', [assetId]);
    
    if (mediaItemResult.rows.length > 0) {
        const mediaItemId = mediaItemResult.rows[0].id;
        const cacheResult = await pool.query(
            `SELECT id, file_path, format FROM generated_assets_3d 
             WHERE media_item_id = $1 AND asset_type = 'splat' AND model_key = $2
             ORDER BY format = 'ksplat' DESC`,
            [mediaItemId, modelKey]
        );
        
        if (cacheResult.rows.length > 0) {
            // Prefer .ksplat over .ply
            const cachedFile = cacheResult.rows[0];
            try {
                const cachedBuffer = await fs.readFile(cachedFile.file_path);
                res.setHeader('Content-Type', 'application/octet-stream');
                res.setHeader('X-Asset-Cache', 'hit');
                res.setHeader('X-Asset-Format', cachedFile.format);
                return res.send(cachedBuffer);
            } catch (err) {
                console.warn(`Cache file missing at ${cachedFile.file_path}, regenerating...`);
            }
        }
    }

    // 2. Fetch Source Image from Immich
    console.log(`[Splat] Fetching image for ${assetId}...`);
    const imageBuffer = await immichConnector.getThumbnail(assetId, { size: 'preview', format: 'JPEG' });
    const assetInfo = await immichConnector.getAssetInfo(assetId);

    // 3. Prepare AI Request
    const formData = new FormData();
    formData.append('image', imageBuffer, {
        filename: assetInfo.originalFileName || 'image.jpg',
        contentType: 'image/jpeg'
    });
    
    const aiUrl = process.env.AI_SERVICE_URL || 'http://ai:5000';
    
    // 4. Call AI Service to generate .ply
    console.log(`[Splat] Calling AI service for ${assetId}...`);
    const aiResponse = await axios.post(`${aiUrl}/api/splat`, formData, {
        headers: formData.getHeaders(),
        responseType: 'arraybuffer',
        timeout: 300000, // 5 minute timeout for splat generation
    });

    const plyBuffer = Buffer.from(aiResponse.data);
    console.log(`[Splat] Received PLY (${plyBuffer.length} bytes)`);
    
    // 5. Save .ply file
    await fs.mkdir(SPLATS_DIR, { recursive: true });
    
    // Get or create media_item
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
    
    const baseFilename = path.parse(assetInfo.originalFileName || `immich_${assetId}`).name;
    const plyFilename = `${baseFilename}_${mediaItemId}_${modelKey}.ply`;
    const plyFilePath = path.join(SPLATS_DIR, plyFilename);
    
    await fs.writeFile(plyFilePath, plyBuffer);
    console.log(`[Splat] Saved PLY to ${plyFilePath}`);
    
    // Record .ply in database
    await pool.query(
        `INSERT INTO generated_assets_3d 
         (media_item_id, asset_type, model_key, format, file_path, file_size, metadata)
         VALUES ($1, 'splat', $2, 'ply', $3, $4, $5)
         ON CONFLICT (media_item_id, asset_type, model_key, format) 
         DO UPDATE SET 
           file_path = EXCLUDED.file_path,
           file_size = EXCLUDED.file_size,
           generated_at = NOW()`,
        [mediaItemId, modelKey, plyFilePath, plyBuffer.length, JSON.stringify({ source: 'ml-sharp' })]
    );
    
    // 6. Convert .ply to .ksplat (background, async)
    convertPlyToKsplat(plyFilePath, mediaItemId, modelKey).catch(err => {
        console.error('[Splat] Conversion failed:', err.message);
    });
    
    // 7. Return .ply for now (frontend will use it or poll for .ksplat)
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('X-Asset-Cache', 'miss');
    res.setHeader('X-Asset-Format', 'ply');
    res.send(plyBuffer);
}

/**
 * Convert .ply to .ksplat format using gaussian-splats-3d CLI
 * This is optimized for Quest 3 browser streaming
 */
async function convertPlyToKsplat(plyFilePath, mediaItemId, modelKey) {
    const ksplatFilePath = plyFilePath.replace('.ply', '.ksplat');
    
    console.log(`[Splat] Converting ${plyFilePath} to .ksplat...`);
    
    return new Promise((resolve, reject) => {
        // Use our local conversion script
        const converterPath = path.join(__dirname, '../scripts/convert-ply-to-ksplat.js');
        const proc = spawn('node', [
            converterPath,
            plyFilePath,
            ksplatFilePath
        ], {
            cwd: process.cwd()
        });
        
        let stdout = '';
        let stderr = '';
        
        proc.stdout.on('data', (data) => { stdout += data.toString(); });
        proc.stderr.on('data', (data) => { stderr += data.toString(); });
        
        proc.on('close', async (code) => {
            if (code === 0) {
                try {
                    // Record .ksplat in database
                    const stats = await fs.stat(ksplatFilePath);
                    await pool.query(
                        `INSERT INTO generated_assets_3d 
                         (media_item_id, asset_type, model_key, format, file_path, file_size, metadata)
                         VALUES ($1, 'splat', $2, 'ksplat', $3, $4, $5)
                         ON CONFLICT (media_item_id, asset_type, model_key, format) 
                         DO UPDATE SET 
                           file_path = EXCLUDED.file_path,
                           file_size = EXCLUDED.file_size,
                           generated_at = NOW()`,
                        [mediaItemId, modelKey, ksplatFilePath, stats.size, JSON.stringify({ converted_from: 'ply' })]
                    );
                    console.log(`[Splat] Conversion complete: ${ksplatFilePath} (${stats.size} bytes)`);
                    resolve(ksplatFilePath);
                } catch (err) {
                    reject(new Error(`Failed to record ksplat: ${err.message}`));
                }
            } else {
                reject(new Error(`Conversion failed (exit ${code}): ${stderr || stdout}`));
            }
        });
        
        proc.on('error', (err) => {
            reject(new Error(`Failed to spawn converter: ${err.message}`));
        });
    });
}

/**
 * Convert .ply to standard .splat format
 * This is more compatible with drei's Splat component
 */
async function convertPlyToSplat(plyFilePath, mediaItemId, modelKey) {
    const splatFilePath = plyFilePath.replace('.ply', '.splat');
    
    console.log(`[Splat] Converting ${plyFilePath} to .splat...`);
    
    return new Promise((resolve, reject) => {
        // Use our local conversion script
        const converterPath = path.join(__dirname, '../scripts/convert-ply-to-splat.js');
        const proc = spawn('node', [
            converterPath,
            plyFilePath,
            splatFilePath
        ], {
            cwd: process.cwd()
        });
        
        let stdout = '';
        let stderr = '';
        
        proc.stdout.on('data', (data) => { stdout += data.toString(); });
        proc.stderr.on('data', (data) => { stderr += data.toString(); });
        
        proc.on('close', async (code) => {
            if (code === 0) {
                try {
                    // Record .splat in database
                    const stats = await fs.stat(splatFilePath);
                    await pool.query(
                        `INSERT INTO generated_assets_3d 
                         (media_item_id, asset_type, model_key, format, file_path, file_size, metadata)
                         VALUES ($1, 'splat', $2, 'splat', $3, $4, $5)
                         ON CONFLICT (media_item_id, asset_type, model_key, format) 
                         DO UPDATE SET 
                           file_path = EXCLUDED.file_path,
                           file_size = EXCLUDED.file_size,
                           generated_at = NOW()`,
                        [mediaItemId, modelKey, splatFilePath, stats.size, JSON.stringify({ converted_from: 'ply' })]
                    );
                    console.log(`[Splat] Conversion complete: ${splatFilePath} (${stats.size} bytes)`);
                    resolve(splatFilePath);
                } catch (err) {
                    reject(new Error(`Failed to record splat: ${err.message}`));
                }
            } else {
                reject(new Error(`Conversion failed (exit ${code}): ${stderr || stdout}`));
            }
        });
        
        proc.on('error', (err) => {
            reject(new Error(`Failed to spawn converter: ${err.message}`));
        });
    });
}


module.exports = router;
