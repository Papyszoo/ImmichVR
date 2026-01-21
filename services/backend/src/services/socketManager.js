const socketIo = require('socket.io');
const pool = require('../config/database');
const fs = require('fs').promises;
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');
const { spawn } = require('child_process');

const SPLATS_DIR = process.env.SPLATS_DIR || '/app/data/splats';
const DEPTH_MAPS_DIR = process.env.DEPTH_MAPS_DIR || '/data/depth_maps';

class SocketManager {
  constructor(server, modelManager) {
    this.io = socketIo(server, {
      cors: {
        origin: "*", // Allow all origins for now (adjust for prod)
        methods: ["GET", "POST"]
      }
    });

    this.modelManager = modelManager;
    this.setupSocketEvents();
    this.setupModelManagerEvents();
  }

  setupSocketEvents() {
    this.io.on('connection', (socket) => {
      console.log(`[Socket] Client connected: ${socket.id}`);

      // Send initial state
      this.sendCurrentState(socket);

      // --- Model Events Recieved from Client ---

      // 1. Load Model
      socket.on('model:load', async (data) => {
        const { modelKey, trigger = 'manual', options = {} } = data;
        console.log(`[Socket] Request load: ${modelKey}`);
        try {
          await this.modelManager.ensureModelLoaded(modelKey, trigger, options);
          // Success is broadcasted via modelManager event listener
        } catch (error) {
          socket.emit('model:error', { message: error.message });
        }
      });

      // 2. Unload Model
      socket.on('model:unload', async () => {
        console.log(`[Socket] Request unload`);
        try {
          await this.modelManager.unloadModel();
        } catch (error) {
          socket.emit('model:error', { message: error.message });
        }
      });

      // 3. Download Model
      socket.on('model:download', async (data) => {
        const { modelKey } = data;
        console.log(`[Socket] Request download: ${modelKey}`);
        try {
          // ModelManager will handle the call and emit status events
          await this.modelManager.downloadModel(modelKey);
        } catch (error) {
          socket.emit('model:error', { message: error.message });
        }
      });

      // 4. Generate Asset
      socket.on('model:generate', async (data) => {
          const { id, type, modelKey } = data;
          console.log(`[Socket] Request generate for ${id}: ${type}/${modelKey}`);
          
          try {
              if (type === 'splat') {
                  await this.handleSplatGeneration(socket, id, modelKey || 'sharp');
              } else if (type === 'depth') {
                  await this.handleDepthGeneration(socket, id, modelKey || 'small');
              } else {
                  socket.emit('model:error', { message: `Unknown generation type: ${type}` });
              }
          } catch (error) {
              console.error(`[Socket] Generation failed:`, error);
              socket.emit('model:error', { id, message: error.message });
              // Also emit completion with failure so queue can proceed (if desired, or queue handles error)
              socket.emit('model:generation-complete', { id, success: false, error: error.message });
          }
      });

      socket.on('disconnect', () => {
        console.log(`[Socket] Client disconnected: ${socket.id}`);
      });
    });
  }

  setupModelManagerEvents() {
    if (!this.modelManager) return;

    // Listen to internal ModelManager events and broadcast to all clients

    this.modelManager.on('model:status', (payload) => {
      // payload: { status, modelKey, loadedAt, etc. }
      this.io.emit('model:status', payload);
    });

    this.modelManager.on('model:download-progress', (payload) => {
      this.io.emit('model:download-progress', payload);
    });
    
    this.modelManager.on('error', (payload) => {
        this.io.emit('model:error', payload);
    });
  }

  async sendCurrentState(socket) {
    // Send what is currently happening
    if (this.modelManager.currentModel) {
      socket.emit('model:status', {
        status: 'loaded',
        modelKey: this.modelManager.currentModel,
        loadedAt: this.modelManager.loadedAt
      });
    } else {
        socket.emit('model:status', { status: 'unloaded', modelKey: null });
    }
  }

  // --- Generation Logic (Adapted from assets.routes.js) ---

  async handleSplatGeneration(socket, assetId, modelKey) {
    socket.emit('model:generation-progress', { id: assetId, status: 'checking_cache', progress: 0 });

    // 1. Check Cache
    const mediaItemResult = await pool.query('SELECT id FROM media_items WHERE immich_asset_id = $1', [assetId]);
    if (mediaItemResult.rows.length > 0) {
        const mediaItemId = mediaItemResult.rows[0].id;
        const cacheResult = await pool.query(
            `SELECT id FROM generated_assets_3d 
             WHERE media_item_id = $1 AND asset_type = 'splat' AND model_key = $2
             AND format = 'ksplat'`, // check for final ksplat
            [mediaItemId, modelKey]
        );
        if (cacheResult.rows.length > 0) {
            console.log(`[Socket] Cache hit for ${assetId}`);
            socket.emit('model:generation-progress', { id: assetId, status: 'complete', progress: 100 });
            socket.emit('model:generation-complete', { id: assetId, success: true, cached: true });
            return;
        }
    }

    // 2. Fetch Image
    socket.emit('model:generation-progress', { id: assetId, status: 'fetching_image', progress: 10 });
    // Need immich connector - simplistic approach: use the one required in routes? 
    // We didn't import immichConnector here. Let's assume it's available or we passed it in constructor?
    // It wasn't passed. We need to require it.
    const { immichConnector } = require('./index'); // access via index or direct

    const imageBuffer = await immichConnector.getThumbnail(assetId, { size: 'preview', format: 'JPEG' });
    const assetInfo = await immichConnector.getAssetInfo(assetId);

    // 3. Prepare AI Request
    socket.emit('model:generation-progress', { id: assetId, status: 'sending_to_ai', progress: 20 });
    const formData = new FormData();
    formData.append('image', imageBuffer, {
        filename: assetInfo.originalFileName || 'image.jpg',
        contentType: 'image/jpeg'
    });

    const aiUrl = process.env.AI_SERVICE_URL || 'http://ai:5000';
    
    // 4. Call AI
    socket.emit('model:generation-progress', { id: assetId, status: 'generating', progress: 30 });
    console.log(`[Socket] Calling AI service for ${assetId}...`);
    
    const aiResponse = await axios.post(`${aiUrl}/api/splat`, formData, {
        headers: formData.getHeaders(),
        responseType: 'arraybuffer',
        timeout: 0, // No timeout for socket operations
    });

    const plyBuffer = Buffer.from(aiResponse.data);
    socket.emit('model:generation-progress', { id: assetId, status: 'saving', progress: 80 });

    // 5. Save & Convert
    await fs.mkdir(SPLATS_DIR, { recursive: true });

    let mediaItemId;
    if (mediaItemResult.rows.length > 0) {
        mediaItemId = mediaItemResult.rows[0].id;
    } else {
         const insertResult = await pool.query(
            `INSERT INTO media_items 
             (original_filename, media_type, immich_asset_id, source_type, file_path, file_size, mime_type, captured_at)
             VALUES ($1, 'photo', $2, 'immich', $3, $4, $5, $6)
             RETURNING id`,
            [
              assetInfo.originalFileName || `immich_${assetId}`, 
              assetId,
              `immich://${assetId}`,
              assetInfo.exifInfo?.fileSizeInByte || 0,
              assetInfo.originalMimeType || 'application/octet-stream',
              assetInfo.exifInfo?.dateTimeOriginal || assetInfo.fileCreatedAt || new Date()
            ]
          );
          mediaItemId = insertResult.rows[0].id;
    }

    const baseFilename = path.parse(assetInfo.originalFileName || `immich_${assetId}`).name;
    const plyFilename = `${baseFilename}_${mediaItemId}_${modelKey}.ply`;
    const plyFilePath = path.join(SPLATS_DIR, plyFilename);
    
    await fs.writeFile(plyFilePath, plyBuffer);

    // Insert PLY record
    await pool.query(
        `INSERT INTO generated_assets_3d 
         (media_item_id, asset_type, model_key, format, file_path, file_size, metadata)
         VALUES ($1, 'splat', $2, 'ply', $3, $4, $5)
         ON CONFLICT (media_item_id, asset_type, model_key, format) 
         DO UPDATE SET file_path = EXCLUDED.file_path, generated_at = NOW()`,
        [mediaItemId, modelKey, plyFilePath, plyBuffer.length, JSON.stringify({ source: 'ml-sharp' })]
    );

    // 6. Convert to KSPLAT
    socket.emit('model:generation-progress', { id: assetId, status: 'converting', progress: 90 });
    
    try {
        await this.convertPlyToKsplat(plyFilePath, mediaItemId, modelKey);
        socket.emit('model:generation-complete', { id: assetId, success: true });
    } catch (err) {
        console.error(`[Socket] Conversion failed for ${assetId}:`, err);
        // Even if conversion fails, we have the PLY, so maybe partial success?
        // But for queue, we probably want complete success.
        socket.emit('model:generation-complete', { id: assetId, success: true, warning: 'conversion_failed' });
    }
  }
  
  async handleDepthGeneration(socket, assetId, modelKey) {
       // Simplified depth generation for socket
       const { immichConnector } = require('./index');
       socket.emit('model:generation-progress', { id: assetId, status: 'generating', progress: 10 });
       
       const mediaItemResult = await pool.query('SELECT id FROM media_items WHERE immich_asset_id = $1', [assetId]);
       
       // ... (Similar steps: Fetch Image -> AI -> Save)
       // For brevity reusing logic. Real implementation should share code.
       // Re-implementing simplified version:
       
       const imageBuffer = await immichConnector.getThumbnail(assetId, { size: 'preview', format: 'JPEG' });
       const assetInfo = await immichConnector.getAssetInfo(assetId);
       
       const formData = new FormData();
       formData.append('image', imageBuffer, { filename: 'image.jpg', contentType: 'image/jpeg' });
       
       const aiUrl = process.env.AI_SERVICE_URL || 'http://ai:5000';
       
       // Ensure model loaded
       await this.modelManager.ensureModelLoaded(modelKey, 'manual');
       
       const aiResponse = await axios.post(`${aiUrl}/api/depth?model=${modelKey}`, formData, {
            headers: formData.getHeaders(),
            responseType: 'arraybuffer',
            timeout: 120000, 
       });
       
       // Save
       const depthBuffer = Buffer.from(aiResponse.data);
       await fs.mkdir(DEPTH_MAPS_DIR, { recursive: true });
       
       let mediaItemId;
       if (mediaItemResult.rows.length > 0) mediaItemId = mediaItemResult.rows[0].id;
       else {
           // Create media item stub... (Simplified)
           const newItem = await pool.query(
                `INSERT INTO media_items (immich_asset_id, media_type, source_type, captured_at, original_filename, file_path, file_size, mime_type) 
                 VALUES ($1, 'photo', 'immich', $2, $3, $4, 0, 'application/octet-stream') 
                 RETURNING id`, 
                [
                    assetId, 
                    assetInfo.exifInfo?.dateTimeOriginal || assetInfo.fileCreatedAt || new Date(),
                    assetInfo.originalFileName || `immich_${assetId}`,
                    `immich://${assetId}`
                ]
            );
           mediaItemId = newItem.rows[0].id;
       }
       
       const fileName = `depth_${mediaItemId}_${modelKey}.png`;
       const filePath = path.join(DEPTH_MAPS_DIR, fileName);
       await fs.writeFile(filePath, depthBuffer);
       
       await pool.query(
          `INSERT INTO generated_assets_3d 
           (media_item_id, asset_type, model_key, format, file_path, file_size, metadata)
           VALUES ($1, 'depth', $2, 'png', $3, $4, $5)
           ON CONFLICT (media_item_id, asset_type, model_key, format) 
           DO UPDATE SET generated_at = NOW()`,
          [mediaItemId, modelKey, filePath, depthBuffer.length, JSON.stringify({})]
       );
       
       socket.emit('model:generation-complete', { id: assetId, success: true });
  }

  async convertPlyToKsplat(plyFilePath, mediaItemId, modelKey) {
        const ksplatFilePath = plyFilePath.replace('.ply', '.ksplat');
        return new Promise((resolve, reject) => {
            const converterPath = path.join(__dirname, '../scripts/convert-ply-to-ksplat.js');
            const proc = spawn('node', [converterPath, plyFilePath, ksplatFilePath], { cwd: process.cwd() });
            proc.on('close', async (code) => {
                if (code === 0) {
                    const stats = await fs.stat(ksplatFilePath);
                    await pool.query(
                        `INSERT INTO generated_assets_3d (media_item_id, asset_type, model_key, format, file_path, file_size, metadata)
                         VALUES ($1, 'splat', $2, 'ksplat', $3, $4, $5)
                         ON CONFLICT (media_item_id, asset_type, model_key, format) DO UPDATE SET generated_at = NOW()`,
                        [mediaItemId, modelKey, ksplatFilePath, stats.size, JSON.stringify({ converted_from: 'ply' })]
                    );
                    resolve(ksplatFilePath);
                } else reject(new Error(`Conversion exited with code ${code}`));
            });
            proc.on('error', reject);
        });
  }
}

module.exports = SocketManager;
