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

class ProcessingWorker {
  constructor(queueManager, apiGateway, pool) {
    this.queueManager = queueManager;
    this.apiGateway = apiGateway;
    this.pool = pool;
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
        // Process the media file through AI service
        const depthMapBuffer = await this.apiGateway.processDepthMap(queueItem.file_path);

        // Save the depth map
        const depthMapPath = await this.saveDepthMap(
          queueItem.media_item_id,
          queueItem.original_filename,
          depthMapBuffer
        );

        // Store depth map metadata in database
        await this.storeDepthMapMetadata(
          queueItem.media_item_id,
          depthMapPath,
          depthMapBuffer.length
        );

        // Calculate processing duration
        const processingDuration = (Date.now() - startTime) / 1000; // in seconds

        // Mark as completed
        await this.queueManager.markCompleted(queueItem.id, processingDuration);

        console.log(`Successfully processed ${queueItem.original_filename} in ${processingDuration.toFixed(2)}s`);

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
  async saveDepthMap(mediaItemId, originalFilename, depthMapBuffer) {
    // Create depth maps directory if it doesn't exist
    const depthMapsDir = process.env.DEPTH_MAPS_DIR || '/data/depth_maps';
    await fs.mkdir(depthMapsDir, { recursive: true });

    // Generate depth map filename
    const baseFilename = path.parse(originalFilename).name;
    const depthMapFilename = `${baseFilename}_${mediaItemId}_depth.png`;
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
  async storeDepthMapMetadata(mediaItemId, depthMapPath, fileSize) {
    const modelName = process.env.AI_MODEL_NAME || DEFAULT_MODEL_NAME;
    const modelVersion = process.env.AI_MODEL_VERSION || DEFAULT_MODEL_VERSION;
    
    await this.pool.query(
      `INSERT INTO depth_map_cache 
       (media_item_id, file_path, file_size, format, width, height, model_name, model_version)
       VALUES ($1, $2, $3, $4, 0, 0, $5, $6)
       ON CONFLICT (media_item_id) 
       DO UPDATE SET 
         file_path = EXCLUDED.file_path,
         file_size = EXCLUDED.file_size,
         generated_at = NOW(),
         accessed_at = NOW(),
         access_count = 0,
         updated_at = NOW()`,
      [mediaItemId, depthMapPath, fileSize, 'png', modelName, modelVersion]
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
