/**
 * Processing Queue Manager
 * Handles priority-based queue management for media processing
 * Priority rules:
 * 1. Photos processed before videos
 * 2. Smaller files processed first within each media type
 */

const { Pool } = require('pg');

class QueueManager {
  constructor(pool) {
    this.pool = pool;
  }

  /**
   * Calculate priority for a media item
   * Lower number = higher priority
   * Photos: priority 1-100 based on file size
   * Videos: priority 101-200 based on file size
   */
  calculatePriority(mediaType, fileSize) {
    // Define size brackets (in bytes)
    const SIZE_BRACKETS = 10; // Divide into 10 brackets
    const MAX_SIZE = 100 * 1024 * 1024; // 100MB as reference max
    
    // Normalize file size to a value between 0-99
    const sizeScore = Math.min(Math.floor((fileSize / MAX_SIZE) * SIZE_BRACKETS * 10), 99);
    
    if (mediaType === 'photo') {
      // Photos: priority 1-100
      return 1 + sizeScore;
    } else if (mediaType === 'video') {
      // Videos: priority 101-200
      return 101 + sizeScore;
    }
    
    // Default fallback
    return 150;
  }

  /**
   * Add a media item to the processing queue
   */
  async enqueueMediaItem(mediaItemId, maxAttempts = 3) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get media item details
      const mediaResult = await client.query(
        'SELECT media_type, file_size FROM media_items WHERE id = $1',
        [mediaItemId]
      );
      
      if (mediaResult.rows.length === 0) {
        throw new Error(`Media item ${mediaItemId} not found`);
      }
      
      const { media_type, file_size } = mediaResult.rows[0];
      
      // Calculate priority
      const priority = this.calculatePriority(media_type, file_size);
      
      // Check if already in queue
      const existingQueue = await client.query(
        'SELECT id, status FROM processing_queue WHERE media_item_id = $1',
        [mediaItemId]
      );
      
      if (existingQueue.rows.length > 0) {
        const existing = existingQueue.rows[0];
        // If failed or cancelled, we can re-queue
        if (existing.status === 'failed' || existing.status === 'cancelled') {
          await client.query(
            `UPDATE processing_queue 
             SET status = 'queued', priority = $1, updated_at = NOW()
             WHERE id = $2`,
            [priority, existing.id]
          );
          await client.query('COMMIT');
          return existing.id;
        } else if (existing.status === 'completed') {
          throw new Error('Media item already processed');
        } else {
          throw new Error('Media item already in queue');
        }
      }
      
      // Insert new queue item
      const insertResult = await client.query(
        `INSERT INTO processing_queue 
         (media_item_id, status, priority, max_attempts)
         VALUES ($1, 'queued', $2, $3)
         RETURNING id`,
        [mediaItemId, priority, maxAttempts]
      );
      
      await client.query('COMMIT');
      return insertResult.rows[0].id;
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get the next item from the queue to process
   * Uses FOR UPDATE SKIP LOCKED for concurrent processing
   */
  async getNextQueueItem() {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get next item with lowest priority (highest priority value) that's queued
      const result = await client.query(
        `SELECT pq.id, pq.media_item_id, pq.priority, pq.attempts, pq.max_attempts,
                m.original_filename, m.media_type, m.file_path, m.file_size
         FROM processing_queue pq
         JOIN media_items m ON pq.media_item_id = m.id
         WHERE pq.status = 'queued'
         ORDER BY pq.priority ASC, pq.queued_at ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED`
      );
      
      if (result.rows.length === 0) {
        await client.query('COMMIT');
        return null;
      }
      
      const queueItem = result.rows[0];
      
      // Update status to processing
      await client.query(
        `UPDATE processing_queue
         SET status = 'processing', 
             started_at = NOW(),
             attempts = attempts + 1,
             updated_at = NOW()
         WHERE id = $1`,
        [queueItem.id]
      );
      
      await client.query('COMMIT');
      return queueItem;
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Mark a queue item as completed
   */
  async markCompleted(queueId, processingDuration) {
    await this.pool.query(
      `UPDATE processing_queue
       SET status = 'completed',
           completed_at = NOW(),
           processing_duration_seconds = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [queueId, processingDuration]
    );
  }

  /**
   * Mark a queue item as failed and handle retry logic
   */
  async markFailed(queueId, errorMessage) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get current queue item
      const result = await client.query(
        'SELECT attempts, max_attempts FROM processing_queue WHERE id = $1',
        [queueId]
      );
      
      if (result.rows.length === 0) {
        throw new Error(`Queue item ${queueId} not found`);
      }
      
      const { attempts, max_attempts } = result.rows[0];
      
      // Determine if we should retry
      const shouldRetry = attempts < max_attempts;
      const newStatus = shouldRetry ? 'queued' : 'failed';
      
      await client.query(
        `UPDATE processing_queue
         SET status = $2,
             last_error = $3,
             error_count = error_count + 1,
             started_at = NULL,
             updated_at = NOW()
         WHERE id = $1`,
        [queueId, newStatus, errorMessage]
      );
      
      await client.query('COMMIT');
      
      return {
        shouldRetry,
        attempts,
        maxAttempts: max_attempts
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const result = await this.pool.query(
      `SELECT 
         COUNT(*) FILTER (WHERE status = 'queued') as queued,
         COUNT(*) FILTER (WHERE status = 'processing') as processing,
         COUNT(*) FILTER (WHERE status = 'completed') as completed,
         COUNT(*) FILTER (WHERE status = 'failed') as failed,
         COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
         COUNT(*) FILTER (WHERE status = 'pending') as pending
       FROM processing_queue`
    );
    
    return result.rows[0];
  }

  /**
   * Get detailed queue status with pagination
   */
  async getQueueItems(options = {}) {
    const {
      status = null,
      limit = 50,
      offset = 0,
      orderBy = 'priority',
      orderDirection = 'ASC'
    } = options;
    
    let query = `
      SELECT pq.id, pq.media_item_id, pq.status, pq.priority, 
             pq.attempts, pq.max_attempts, pq.last_error,
             pq.queued_at, pq.started_at, pq.completed_at,
             m.original_filename, m.media_type, m.file_size
      FROM processing_queue pq
      JOIN media_items m ON pq.media_item_id = m.id
    `;
    
    const params = [];
    
    if (status) {
      query += ' WHERE pq.status = $1';
      params.push(status);
    }
    
    query += ` ORDER BY pq.${orderBy} ${orderDirection}, pq.queued_at ASC`;
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    
    const result = await this.pool.query(query, params);
    return result.rows;
  }

  /**
   * Get a specific queue item by ID
   */
  async getQueueItem(queueId) {
    const result = await this.pool.query(
      `SELECT pq.*, m.original_filename, m.media_type, m.file_size, m.file_path
       FROM processing_queue pq
       JOIN media_items m ON pq.media_item_id = m.id
       WHERE pq.id = $1`,
      [queueId]
    );
    
    return result.rows[0] || null;
  }

  /**
   * Cancel a queue item
   */
  async cancelQueueItem(queueId) {
    const result = await this.pool.query(
      `UPDATE processing_queue
       SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1 AND status IN ('queued', 'pending')
       RETURNING id`,
      [queueId]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Queue item not found or cannot be cancelled');
    }
    
    return result.rows[0];
  }

  /**
   * Retry a failed queue item
   */
  async retryQueueItem(queueId) {
    const result = await this.pool.query(
      `UPDATE processing_queue
       SET status = 'queued', 
           attempts = 0,
           error_count = 0,
           last_error = NULL,
           started_at = NULL,
           completed_at = NULL,
           updated_at = NOW()
       WHERE id = $1 AND status = 'failed'
       RETURNING id`,
      [queueId]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Queue item not found or not in failed status');
    }
    
    return result.rows[0];
  }
}

module.exports = QueueManager;
