/**
 * usePhoto3DManager.js
 * 
 * Business logic hook for managing 3D view options for a photo.
 * Extracts logic from UI components to create a clean separation of concerns.
 * 
 * This hook processes raw data (generated files, available models) and returns
 * a structured viewOptions array that UI components can render directly.
 */

import { useMemo } from 'react';

/**
 * Determine the status of a model for a given photo
 * 
 * @param {string} modelKey - The model identifier
 * @param {Array} generatedFiles - Files generated for this photo
 * @param {boolean} isDownloaded - Whether the model is downloaded
 * @returns {Object} Status object with status, fileId, and action flags
 */
function determineModelStatus(modelKey, generatedFiles, isDownloaded, modelType = 'depth') {
  // Find files for this model
  const modelFiles = generatedFiles.filter(f => f.modelKey === modelKey);
  
  if (!isDownloaded) {
    return {
      status: 'not_installed',
      fileId: null,
      canGenerate: false,
      canConvert: false,
      canRemove: false,
    };
  }
  
  // SPECIAL HANDLING: SHARP splat model
  // The 'sharp' row should ONLY care about the raw PLY format.
  // The KSPLAT row is handled separately via the virtual entry.
  if (modelKey === 'sharp' && modelType === 'splat') {
    const plyFile = modelFiles.find(f => f.format === 'ply');
    if (plyFile) {
      return {
        status: 'ready',
        fileId: plyFile.id,
        canGenerate: false,
        canConvert: false,
        canRemove: true,
      };
    }
  } else {
    // Check for ready-to-use formats for other models
    const hasReadyFormat = modelFiles.some(f => 
      f.format === 'png' ||       // Depth map (PNG)
      f.format === 'jpg' ||       // Depth map (JPEG)
      f.format === 'ksplat'       // Compressed splat (Quest 3 optimized)
    );
    
    if (hasReadyFormat) {
      const readyFile = modelFiles.find(f => 
        f.format === 'png' || f.format === 'jpg' || f.format === 'ksplat'
      );
      return {
        status: 'ready',
        fileId: readyFile.id,
        canGenerate: false,
        canConvert: false,
        canRemove: true,
      };
    }
    
    // For general splat models (non-SHARP), PLY is a usable format
    const hasPly = modelFiles.some(f => f.format === 'ply');
    if (hasPly && modelType === 'splat') {
      const plyFile = modelFiles.find(f => f.format === 'ply');
      return {
        status: 'ready',
        fileId: plyFile.id,
        canGenerate: false,
        canConvert: false,
        canRemove: true,
      };
    }
  }
  
  // Model is downloaded but no matching files generated
  return {
    status: 'missing',
    fileId: null,
    canGenerate: true,
    canConvert: false,
    canRemove: false,
  };
}

/**
 * usePhoto3DManager Hook
 * 
 * @param {Object} params
 * @param {Array} params.generatedFiles - Array of generated files from backend
 * @param {Array} params.availableModels - Array of AI models with metadata
 * @param {string} params.photoId - Current photo ID
 * @returns {Object} { viewOptions, isLoading }
 */
export function usePhoto3DManager({ generatedFiles = [], availableModels = [], photoId }) {
  const viewOptions = useMemo(() => {
    if (!photoId || availableModels.length === 0) {
      return [];
    }
    
    const options = [];
    
    // Map each available model to a view option
    
    // Always add "Original Photo" option first
    options.push({
      key: 'normal',
      name: 'Original Photo',
      type: 'normal',
      params: '2D',
      status: 'ready',
      fileId: null,
      canGenerate: false,
      canConvert: false,
      canRemove: false,
      isDownloaded: true,
    });

    availableModels.forEach(model => {
      const isDownloaded = model.is_downloaded || false;
      const modelType = model.type || 'depth';
      const statusInfo = determineModelStatus(model.key, generatedFiles, isDownloaded, modelType);
      
      options.push({
        key: model.key,
        name: model.name || model.key,
        type: modelType,
        params: model.params_size || '',
        status: statusInfo.status,
        fileId: statusInfo.fileId,
        canGenerate: statusInfo.canGenerate,
        canConvert: statusInfo.canConvert,
        canRemove: statusInfo.canRemove,
        isDownloaded,
      });
      
      // If this is SHARP model, check if we should create virtual KSPLAT entry
      if (model.key === 'sharp' && model.type === 'splat') {
        const sharpFiles = generatedFiles.filter(f => f.modelKey === 'sharp');
        const hasPly = sharpFiles.some(f => f.format === 'ply');
        const ksplatFile = sharpFiles.find(f => f.format === 'ksplat');
        
        // Show KSPLAT entry if it exists OR if the source PLY exists (allowing conversion)
        if (hasPly || ksplatFile) {
          // KSPLAT entry (compressed format)
          if (ksplatFile) {
            options.push({
              key: 'ksplat',
              name: 'KSPLAT',
              type: 'splat',
              params: 'Compressed',
              status: 'ready',
              fileId: ksplatFile.id,
              canGenerate: false,
              canConvert: false,
              canRemove: true,
              isDownloaded: true,
              isVirtual: true,
            });
          } else {
            options.push({
              key: 'ksplat',
              name: 'KSPLAT',
              type: 'splat',
              params: 'Compressed',
              status: 'missing',
              fileId: null,
              canGenerate: true,
              canConvert: false,
              canRemove: false,
              isDownloaded: true,
              isVirtual: true,
            });
          }
        }
      }
    });
    
    return options;
  }, [generatedFiles, availableModels, photoId]);
  
  return {
    viewOptions,
    isLoading: false, // Can be extended to track loading state
  };
}

export default usePhoto3DManager;
