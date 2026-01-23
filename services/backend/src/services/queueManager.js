/**
 * QueueManager
 * Manages the sequential processing of 3D generation tasks.
 * Ensures only one heavy generation task runs at a time.
 */
class QueueManager {
    constructor() {
        this.queue = [];
        this.processingItem = null;
        this.isProcessing = false;
        this.executor = null; // Function to execute the job
        this.io = null; // Socket.io instance for broadcasting updates
    }

    /**
     * Set the executor function (the logic that runs the generation)
     * @param {Function} executor - async function(job)
     */
    setExecutor(executor) {
        this.executor = executor;
    }

    /**
     * Set Socket.io instance
     */
    setSocketIO(io) {
        this.io = io;
    }

    /**
     * Add a job to the queue
     * @param {Object} job - { id: string, type: string, modelKey: string, socketId: string }
     */
    enqueue(job) {
        // Prevent duplicates
        const exists = this.queue.find(j => j.id === job.id && j.type === job.type && j.modelKey === job.modelKey);
        const isCurrentlyProcessing = this.processingItem && 
                                      this.processingItem.id === job.id && 
                                      this.processingItem.type === job.type && 
                                      this.processingItem.modelKey === job.modelKey;

        if (exists || isCurrentlyProcessing) {
            console.log(`[Queue] Job already queued/processing: ${job.id} (${job.type})`);
            return;
        }

        this.queue.push(job);
        console.log(`[Queue] Added job: ${job.id} (${job.type}). Queue length: ${this.queue.length}`);
        
        this.broadcastStatus();
        this.processNext();
    }

    /**
     * Process the next item in the queue
     */
    async processNext() {
        if (this.isProcessing) return;
        if (this.queue.length === 0) return;

        this.isProcessing = true;
        this.processingItem = this.queue.shift();
        
        console.log(`[Queue] Processing job: ${this.processingItem.id} (${this.processingItem.type})`);
        this.broadcastStatus();

        try {
            if (this.executor) {
                await this.executor(this.processingItem);
            } else {
                console.error('[Queue] No executor configured!');
            }
        } catch (err) {
            console.error(`[Queue] Job failed: ${err.message}`);
        } finally {
            this.isProcessing = false;
            this.processingItem = null;
            this.processNext(); // Trigger next
            this.broadcastStatus();
        }
    }

    /**
     * Remove a job from queue (if not yet started)
     */
    remove(jobId) {
        this.queue = this.queue.filter(j => j.id !== jobId);
        this.broadcastStatus();
    }

    /**
     * Get current status
     */
    getStatus() {
        return {
            length: this.queue.length,
            isProcessing: this.isProcessing,
            current: this.processingItem
        };
    }

    broadcastStatus() {
        if (this.io) {
            this.io.emit('queue:update', this.getStatus());
        }
    }
}

module.exports = new QueueManager();
