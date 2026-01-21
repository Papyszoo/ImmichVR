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
  const [queue, setQueue] = useState([]);
  const [processingItem, setProcessingItem] = useState(null);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalQueued, setTotalQueued] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false); // New state for processing status
  
  // Ref to track processing state without dependency loops - NO LONGER USED, replaced by isProcessing state
  // const isProcessingRef = useRef(false);

  /**
   * Add items to the queue
   * @param {Array<{id: string, modelKey: string, type: string}>} items 
   */
  const addToQueue = useCallback((items) => {
    if (!items || items.length === 0) return;
    
    // Normalize to array
    const newItems = Array.isArray(items) ? items : [items];
    
    setQueue(prev => {
      // Filter out duplicates (already in queue)
      const uniqueNewItems = newItems.filter(newItem => 
        !prev.some(p => p.id === newItem.id && p.modelKey === newItem.modelKey) &&
        (!processingItem || (processingItem.id !== newItem.id || processingItem.modelKey !== newItem.modelKey))
      );
      
      if (uniqueNewItems.length > 0) {
        setTotalQueued(t => t + uniqueNewItems.length);
        return [...prev, ...uniqueNewItems];
      }
      return prev;
    });
  }, [processingItem]);

  /**
   * Remove specific item from queue
   */
  const removeFromQueue = useCallback((photoId, modelKey) => {
    setQueue(prev => prev.filter(item => !(item.id === photoId && item.modelKey === modelKey)));
  }, []);

  /**
   * Clear the entire queue
   */
  const clearQueue = useCallback(() => {
    setQueue([]);
    setProcessingItem(null);
    setIsProcessing(false); // Use the new state
    setProcessedCount(0);
    setTotalQueued(0);
  }, []);

  // Process queue logic (Socket.IO based)
  useEffect(() => {
     if (queue.length === 0 || isProcessing || processingItem) return;
     
     const item = queue[0];
     setProcessingItem(item);
     setQueue(prev => prev.slice(1));
     setIsProcessing(true);
     
     console.log(`[Queue] Starting processing for ${item.id} via Socket...`);

     // Trigger generation via Socket
     modelSocket.generate(item.id, item.type, item.modelKey);

     // Note: We don't set a timeout here. We wait indefinitely for the socket event.
     // In a robust system, we might want a simple "Keep Alive" check, but requested behavior
     // is strict "wait for message".

  }, [queue, isProcessing, processingItem]);

  // Listen for Socket Completion Events
  useEffect(() => {
      const handleComplete = (data) => {
          if (!processingItem) return;
          
          // Check if this completion event is for our current item
          if (data.id === processingItem.id) {
              console.log(`[Queue] Item ${data.id} finished! Success: ${data.success}`);
              if (data.success) {
                  setProcessedCount(prev => prev + 1);
              } else {
                  console.warn(`[Queue] Item failed: ${data.error}`);
              }
              
              // Reset state to trigger next item
              setIsProcessing(false);
              setProcessingItem(null);
              
              // Trigger callback
              if (onItemComplete) {
                  onItemComplete(data);
              }
          }
      };
      
      const handleProgress = (data) => {
          // Optional: We could expose detailed progress state
          if (processingItem && data.id === processingItem.id) {
               console.log(`[Queue] Progress: ${data.status} ${data.progress}%`);
          }
      };

      const cleanupComplete = modelSocket.onGenerationComplete(handleComplete);
      const cleanupProgress = modelSocket.onGenerationProgress(handleProgress);
      
      return () => {
          cleanupComplete();
          cleanupProgress();
      };
  }, [processingItem]);

  // Old queue pumping logic removed.
  // Old useEffect for queue finished logic removed.

  return {
    queue,
    processingItem,
    addToQueue,
    removeFromQueue,
    clearQueue,
    queueStatus: {
      total: totalQueued,
      processed: processedCount,
      // remaining: queue.length, // Removed as per new structure
      isProcessing: isProcessing || !!processingItem // Use new isProcessing state
    }
  };
}
