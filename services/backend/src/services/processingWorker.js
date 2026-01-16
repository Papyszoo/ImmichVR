/**
 * Processing Worker
 * Handles actual processing of queue items
 * Coordinates between queue manager and AI gateway
 */

const fs = require('fs').promises;
const path = require('path');

// Configuration constants
const DEFAULT_MODEL_NAME = 'Depth-Anything-V2';
const DEFAULT_MODEL_VERSION = 'small';

// Video processing configuration
const ENABLE_EXPERIMENTAL_VIDEO = process.env.ENABLE_EXPERIMENTAL_VIDEO === 'true';
const VIDEO_FRAME_EXTRACTION_FPS = parseFloat(process.env.VIDEO_FRAME_EXTRACTION_FPS) || 1;
const VIDEO_MAX_FRAMES = parseInt(process.env.VIDEO_MAX_FRAMES) || 30;
const VIDEO_FRAME_METHOD = process.env.VIDEO_FRAME_METHOD || 'interval';

// Video SBS processing configuration
const VIDEO_SBS_DIVERGENCE = parseFloat(process.env.VIDEO_SBS_DIVERGENCE) || 2.0;
const VIDEO_SBS_FORMAT = process.env.VIDEO_SBS_FORMAT || 'SBS_FULL';

// Version-specific filename suffixes
const VERSION_SUFFIXES = {
  'thumbnail': '_thumb',
  'full_resolution': ''
};

class ProcessingWorker {
  constructor(queueManager, apiGateway, pool, modelManager) {
    this.queueManager = queueManager;
    this.apiGateway = apiGateway;
    this.pool = pool;
    this.modelManager = modelManager;
    this.isProcessing = false;
    this.processingInterval = null;
  }

  /**
   * Start the processing worker
   */
  start(intervalMs = 5000) {
    if (this.processingInterval) {
      console.log('Processing worker already running');
      return;
    }

    console.log(`Starting processing worker with ${intervalMs}ms interval`);
    
    // Process immediately, then on interval
    this.processNext();
    
    this.processingInterval = setInterval(() => {
      this.processNext();
    }, intervalMs);
  }

  /**
   * Stop the processing worker
   */
  stop() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      console.log('Processing worker stopped');
    }
  }

  /**
   * Process the next item in the queue
   */
  async processNext() {
    // Skip if already processing
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      // Get next item from queue
      const queueItem = await this.queueManager.getNextQueueItem();

      if (!queueItem) {
        // No items to process
        this.isProcessing = false;
        return;
      }

      console.log(`Processing queue item ${queueItem.id} - ${queueItem.original_filename} (${queueItem.media_type})`);

      const startTime = Date.now();

      try {
        // Check if this is a video and experimental video processing is disabled
        if (queueItem.media_type === 'video' && !ENABLE_EXPERIMENTAL_VIDEO) {
          throw new Error('Video processing is experimental and currently disabled. Set ENABLE_EXPERIMENTAL_VIDEO=true to enable.');
        }

        // --- MODEL MANAGEMENT INTEGRATION ---
        // Ensure the required model is loaded before processing
        // For background processing, we assume 'auto' trigger unless specified otherwise
        // Use default model (small) or user preference if we had access to it here (we can query if needed)
        // For MVP, just use 'small' or what's configured in env/constants.
        // Actually, let's query the global setting or assume 'small' for now to be safe.
        // Better: Query user_settings table for default model.
        
        let targetModel = DEFAULT_MODEL_VERSION; 
        try {
           const settingsRes = await this.pool.query('SELECT default_depth_model FROM user_settings WHERE user_id IS NULL');
           if (settingsRes.rows.length > 0) {
               targetModel = settingsRes.rows[0].default_depth_model;
           }
        } catch (err) {
            console.warn('Failed to fetch default model preference, using default:', targetModel);
        }

        if (this.modelManager) {
            // "Entering a photo" triggers queue, which triggers this.
            // If this is a BACKGROUND job (e.g. batch), 'auto' is appropriate.
            // If this was triggered by user "Enter VR", it's also 'auto' in 30min sense.
            await this.modelManager.ensureModelLoaded(targetModel, 'auto');
        }
        // ------------------------------------

        // Get media item details to check for thumbnail path
        const mediaResult = await this.pool.query(
          'SELECT file_path, thumbnail_path FROM media_items WHERE id = $1',
          [queueItem.media_item_id]
        );

        if (mediaResult.rows.length === 0) {
          throw new Error(`Media item ${queueItem.media_item_id} not found`);
        }

        const { file_path: fullResPath, thumbnail_path: thumbnailPath } = mediaResult.rows[0];

        // Process both thumbnail (if available) and full-resolution versions
        const processedVersions = [];
        const processingErrors = [];

        // Handle video processing differently
        if (queueItem.media_type === 'video') {
          console.log(`Processing video to SBS: ${queueItem.original_filename} [EXPERIMENTAL]`);
          try {
            await this.processVideoSBS(
              queueItem.media_item_id,
              queueItem.original_filename,
              fullResPath
            );
            processedVersions.push('sbs_video');
          } catch (videoError) {
            console.error(`Failed to process video SBS ${queueItem.original_filename}:`, videoError.message);
            processingErrors.push(`video_sbs: ${videoError.message}`);
          }
        } else {
          // Process photo normally
          // Process thumbnail version first (smaller, faster)
        if (thumbnailPath) {
          console.log(`Processing thumbnail version for ${queueItem.original_filename}`);
          try {
            const thumbnailDepthBuffer = await this.apiGateway.processDepthMap(thumbnailPath);
            const thumbnailDepthPath = await this.saveDepthMap(
              queueItem.media_item_id,
              queueItem.original_filename,
              thumbnailDepthBuffer,
              'thumbnail'
            );
            await this.storeDepthMapMetadata(
              queueItem.media_item_id,
              thumbnailDepthPath,
              thumbnailDepthBuffer.length,
              'thumbnail'
            );
            processedVersions.push('thumbnail');
          } catch (thumbError) {
            console.error(`Failed to process thumbnail for ${queueItem.original_filename}:`, thumbError.message);
            processingErrors.push(`thumbnail: ${thumbError.message}`);
            // Continue to process full-resolution even if thumbnail fails
          }
        }

        // Process full-resolution version
        console.log(`Processing full-resolution version for ${queueItem.original_filename}`);
        try {
          const fullResDepthBuffer = await this.apiGateway.processDepthMap(fullResPath);
          const fullResDepthPath = await this.saveDepthMap(
            queueItem.media_item_id,
            queueItem.original_filename,
            fullResDepthBuffer,
            'full_resolution'
          );
          await this.storeDepthMapMetadata(
            queueItem.media_item_id,
            fullResDepthPath,
            fullResDepthBuffer.length,
            'full_resolution'
          );
          processedVersions.push('full_resolution');
        } catch (fullResError) {
          console.error(`Failed to process full-resolution for ${queueItem.original_filename}:`, fullResError.message);
          processingErrors.push(`full_resolution: ${fullResError.message}`);
        }
        }

        // --- MODEL ACTIVITY REGISTRATION ---
        if (this.modelManager) {
            await this.modelManager.registerActivity('auto');
        }
        // -----------------------------------

        // If no versions were successfully processed, fail the queue item
        if (processedVersions.length === 0) {
          throw new Error(`All versions failed: ${processingErrors.join('; ')}`);
        }

        // Calculate processing duration
        const processingDuration = (Date.now() - startTime) / 1000; // in seconds

        // Mark as completed (even if only partial success)
        await this.queueManager.markCompleted(queueItem.id, processingDuration);

        const statusMessage = processingErrors.length > 0
          ? `Partially processed ${queueItem.original_filename} (${processedVersions.join(', ')}) with errors: ${processingErrors.join('; ')}`
          : `Successfully processed ${queueItem.original_filename} (${processedVersions.join(', ')})`;
        
        console.log(`${statusMessage} in ${processingDuration.toFixed(2)}s`);

      } catch (error) {
        console.error(`Error processing ${queueItem.original_filename}:`, error.message);

        // Mark as failed and let queue manager handle retry logic
        const retryInfo = await this.queueManager.markFailed(queueItem.id, error.message);

        if (retryInfo.shouldRetry) {
          console.log(`Will retry (attempt ${retryInfo.attempts}/${retryInfo.maxAttempts})`);
        } else {
          console.log(`Max attempts reached (${retryInfo.maxAttempts}), marking as failed`);
        }
      }

    } catch (error) {
      console.error('Error in processing worker:', error.message);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Save depth map to disk
   */
  async saveDepthMap(mediaItemId, originalFilename, depthMapBuffer, versionType = 'full_resolution') {
    // Create depth maps directory if it doesn't exist
    const depthMapsDir = process.env.DEPTH_MAPS_DIR || '/data/depth_maps';
    await fs.mkdir(depthMapsDir, { recursive: true });

    // Generate depth map filename with version type
    const baseFilename = path.parse(originalFilename).name;
    const versionSuffix = VERSION_SUFFIXES[versionType] || '';
    const depthMapFilename = `${baseFilename}_${mediaItemId}${versionSuffix}_depth.png`;
    const depthMapPath = path.join(depthMapsDir, depthMapFilename);

    // Write the depth map to disk
    await fs.writeFile(depthMapPath, depthMapBuffer);

    return depthMapPath;
  }

  /**
   * Store depth map metadata in database
   * Note: Width and height are set to 0 as a placeholder.
   * For accurate dimensions, image processing library like 'sharp' would be needed.
   */
  async storeDepthMapMetadata(mediaItemId, depthMapPath, fileSize, versionType = 'full_resolution') {
    const modelName = process.env.AI_MODEL_NAME || DEFAULT_MODEL_NAME;
    const modelVersion = process.env.AI_MODEL_VERSION || DEFAULT_MODEL_VERSION;
    
    await this.pool.query(
      `INSERT INTO depth_map_cache 
       (media_item_id, file_path, file_size, format, width, height, model_name, model_version, version_type)
       VALUES ($1, $2, $3, $4, 0, 0, $5, $6, $7)
       ON CONFLICT (media_item_id, version_type) 
       DO UPDATE SET 
         file_path = EXCLUDED.file_path,
         file_size = EXCLUDED.file_size,
         generated_at = NOW(),
         accessed_at = NOW(),
         access_count = 0,
         updated_at = NOW()`,
      [mediaItemId, depthMapPath, fileSize, 'png', modelName, modelVersion, versionType]
    );
  }

  /**
   * Process video depth map (experimental)
   * Extracts frames and generates depth maps for each frame
   */
  async processVideoDepthMap(mediaItemId, originalFilename, videoPath) {
    console.log(`[EXPERIMENTAL] Processing video depth map for ${originalFilename}`);
    
    try {
      // Call AI service to process video and get depth map frames
      const depthMapsZip = await this.apiGateway.processVideoDepthMap(
        videoPath,
        VIDEO_FRAME_EXTRACTION_FPS,
        VIDEO_MAX_FRAMES,
        VIDEO_FRAME_METHOD
      );
      
      // Save the ZIP file containing depth map frames
      const depthMapsDir = process.env.DEPTH_MAPS_DIR || '/data/depth_maps';
      await fs.mkdir(depthMapsDir, { recursive: true });
      
      const baseFilename = path.parse(originalFilename).name;
      const depthMapZipFilename = `${baseFilename}_${mediaItemId}_video_depth_frames.zip`;
      const depthMapZipPath = path.join(depthMapsDir, depthMapZipFilename);
      
      await fs.writeFile(depthMapZipPath, depthMapsZip);
      
      // Store metadata in database with special version_type for videos
      await this.storeVideoDepthMapMetadata(
        mediaItemId,
        depthMapZipPath,
        depthMapsZip.length
      );
      
      console.log(`[EXPERIMENTAL] Successfully processed video depth map: ${depthMapZipPath}`);
      
    } catch (error) {
      console.error(`[EXPERIMENTAL] Error processing video depth map:`, error.message);
      throw error;
    }
  }

  /**
   * Process video to Side-by-Side 3D format (experimental)
   * Generates a complete SBS video file for VR playback
   */
  async processVideoSBS(mediaItemId, originalFilename, videoPath) {
    console.log(`[EXPERIMENTAL] Processing video to SBS for ${originalFilename}`);
    console.log(`  Divergence: ${VIDEO_SBS_DIVERGENCE}, Format: ${VIDEO_SBS_FORMAT}`);
    
    try {
      // Call AI service to process video and generate SBS output
      const sbsVideoBuffer = await this.apiGateway.processVideoSBS(
        videoPath,
        VIDEO_SBS_DIVERGENCE,
        VIDEO_SBS_FORMAT,
        'h264',  // codec
        10       // batch_size
      );
      
      // Save the SBS video file
      const depthMapsDir = process.env.DEPTH_MAPS_DIR || '/data/depth_maps';
      await fs.mkdir(depthMapsDir, { recursive: true });
      
      const baseFilename = path.parse(originalFilename).name;
      const sbsVideoFilename = `${baseFilename}_${mediaItemId}_sbs.mp4`;
      const sbsVideoPath = path.join(depthMapsDir, sbsVideoFilename);
      
      await fs.writeFile(sbsVideoPath, sbsVideoBuffer);
      
      // Store metadata in database
      await this.storeVideoSBSMetadata(
        mediaItemId,
        sbsVideoPath,
        sbsVideoBuffer.length
      );
      
      console.log(`[EXPERIMENTAL] Successfully created SBS video: ${sbsVideoPath}`);
      
    } catch (error) {
      console.error(`[EXPERIMENTAL] Error processing video to SBS:`, error.message);
      throw error;
    }
  }

  /**
   * Store video depth map metadata in database
   */
  async storeVideoDepthMapMetadata(mediaItemId, depthMapZipPath, fileSize) {
    const modelName = process.env.AI_MODEL_NAME || DEFAULT_MODEL_NAME;
    const modelVersion = process.env.AI_MODEL_VERSION || DEFAULT_MODEL_VERSION;
    
    const processingParams = {
      fps: VIDEO_FRAME_EXTRACTION_FPS,
      max_frames: VIDEO_MAX_FRAMES,
      method: VIDEO_FRAME_METHOD,
      format: 'zip_frames',
      experimental: true
    };
    
    await this.pool.query(
      `INSERT INTO depth_map_cache 
       (media_item_id, file_path, file_size, format, width, height, model_name, model_version, version_type, processing_params)
       VALUES ($1, $2, $3, $4, 0, 0, $5, $6, $7, $8)
       ON CONFLICT (media_item_id, version_type) 
       DO UPDATE SET 
         file_path = EXCLUDED.file_path,
         file_size = EXCLUDED.file_size,
         processing_params = EXCLUDED.processing_params,
         generated_at = NOW(),
         accessed_at = NOW(),
         access_count = 0,
         updated_at = NOW()`,
      [mediaItemId, depthMapZipPath, fileSize, 'raw', modelName, modelVersion, 'full_resolution', JSON.stringify(processingParams)]
    );
  }

  /**
   * Store video SBS metadata in database
   */
  async storeVideoSBSMetadata(mediaItemId, sbsVideoPath, fileSize) {
    const modelName = process.env.AI_MODEL_NAME || DEFAULT_MODEL_NAME;
    const modelVersion = process.env.AI_MODEL_VERSION || DEFAULT_MODEL_VERSION;
    
    const processingParams = {
      divergence: VIDEO_SBS_DIVERGENCE,
      sbs_format: VIDEO_SBS_FORMAT,
      output_type: 'sbs_video',
      codec: 'h264',
      experimental: true
    };
    
    await this.pool.query(
      `INSERT INTO depth_map_cache 
       (media_item_id, file_path, file_size, format, width, height, model_name, model_version, version_type, processing_params)
       VALUES ($1, $2, $3, $4, 0, 0, $5, $6, $7, $8)
       ON CONFLICT (media_item_id, version_type) 
       DO UPDATE SET 
         file_path = EXCLUDED.file_path,
         file_size = EXCLUDED.file_size,
         processing_params = EXCLUDED.processing_params,
         generated_at = NOW(),
         accessed_at = NOW(),
         access_count = 0,
         updated_at = NOW()`,
      [mediaItemId, sbsVideoPath, fileSize, 'raw', modelName, modelVersion, 'full_resolution', JSON.stringify(processingParams)]
    );
  }

  /**
   * Get current processing status
   */
  isRunning() {
    return this.processingInterval !== null;
  }

  /**
   * Get worker status
   */
  getStatus() {
    return {
      running: this.isRunning(),
      processing: this.isProcessing
    };
  }
}

module.exports = ProcessingWorker;
