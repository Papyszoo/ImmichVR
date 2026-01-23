import { useState, useEffect, useCallback, useRef } from 'react';
import { generateAsset, convertPlyToKsplat } from '../services/api';
import { modelSocket } from '../services/socket';

/**
 * use3DGenerationQueue
 * 
 * Manages a queue of photos to be processed (generated) sequentially.
 * This prevents overwhelming the backend or the client with parallel heavy requests.
 * 
 * @returns {Object} Queue state and methods
 */
export function use3DGenerationQueue(onItemComplete) {
  const [queueStatus, setQueueStatus] = useState({ length: 0, isProcessing: false, current: null });
  
  // Listen for backend queue updates
  useEffect(() => {
      const handleQueueUpdate = (status) => {
          console.log('[QueueHook] Backend queue update:', status);
          setQueueStatus(status);
      };

      const cleanup = modelSocket.onQueueUpdate(handleQueueUpdate);
      
      // Request initial status
      modelSocket.getQueueStatus();

      return cleanup;
  }, []);

  // Listen for completion (to notify parent)
  useEffect(() => {
      const handleComplete = (data) => {
          if (data.success) {
               console.log(`[QueueHook] Item completed: ${data.id}`);
               if (onItemComplete) onItemComplete(data);
          }
      };
      
      const cleanup = modelSocket.onGenerationComplete(handleComplete);
      return cleanup;
  }, [onItemComplete]);

  /**
   * Add items to the (backend) queue
   */
  const addToQueue = useCallback((items) => {
    if (!items) return;
    const itemsArray = Array.isArray(items) ? items : [items];
    
    itemsArray.forEach(item => {
        console.log(`[QueueHook] Sending generation request for ${item.id}`);
        modelSocket.generate(item.id, item.type, item.modelKey);
    });
  }, []);

  const clearQueue = useCallback(() => {
    // Backend doesn't support clear yet, but we can't clear backend queue easily without admin rights?
    // For now, no-op or maybe implement 'queue:clear' later.
    console.warn('Clear queue not fully supported in backend mode yet.');
  }, []);

  // Expose debug info
  useEffect(() => {
    window.__VR_QUEUE_DEBUG = queueStatus;
  }, [queueStatus]);

  return {
    addToQueue,
    clearQueue,
    queueStatus: {
      total: queueStatus.length + (queueStatus.isProcessing ? 1 : 0), // Approx
      processed: 0, // We don't track historical processed count from backend easily without fetching history
      isProcessing: queueStatus.isProcessing,
      current: queueStatus.current
    },
    // Compatibility fields for existing UI if needed
    queue: new Array(queueStatus.length).fill({}), // Dummy array to show length
    processingItem: queueStatus.current
  };
}
