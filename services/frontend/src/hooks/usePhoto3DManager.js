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
function determineModelStatus(modelKey, generatedFiles, isDownloaded) {
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
  
  // Check for ready-to-use formats
  const hasReadyFormat = modelFiles.some(f => 
    f.format === 'png' ||       // Depth map (PNG)
    f.format === 'jpg' ||       // Depth map (JPEG)
    f.format === 'splat' ||     // Web-ready splat
    f.format === 'ksplat'       // Compressed splat (Quest 3 optimized)
  );
  
  if (hasReadyFormat) {
    const readyFile = modelFiles.find(f => 
      f.format === 'png' || f.format === 'jpg' || f.format === 'splat' || f.format === 'ksplat'
    );
    return {
      status: 'ready',
      fileId: readyFile.id,
      canGenerate: false,
      canConvert: false,
      canRemove: true,
    };
  }
  
  // Check for raw format that needs conversion
  const hasPly = modelFiles.some(f => f.format === 'ply');
  if (hasPly) {
    const plyFile = modelFiles.find(f => f.format === 'ply');
    return {
      status: 'can_convert',
      fileId: plyFile.id,
      canGenerate: false,
      canConvert: true,
      canRemove: true,
    };
  }
  
  // Model is downloaded but no files generated
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
    
    // Map each available model to a view option
    return availableModels.map(model => {
      const isDownloaded = model.is_downloaded || false;
      const statusInfo = determineModelStatus(model.key, generatedFiles, isDownloaded);
      
      return {
        key: model.key,
        name: model.name || model.key,
        type: model.type || 'depth',
        params: model.params_size || '',
        status: statusInfo.status,
        fileId: statusInfo.fileId,
        canGenerate: statusInfo.canGenerate,
        canConvert: statusInfo.canConvert,
        canRemove: statusInfo.canRemove,
        isDownloaded,
      };
    });
  }, [generatedFiles, availableModels, photoId]);
  
  return {
    viewOptions,
    isLoading: false, // Can be extended to track loading state
  };
}

export default usePhoto3DManager;
