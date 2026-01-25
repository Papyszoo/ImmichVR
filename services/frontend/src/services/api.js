import axios from 'axios';

// Backend API base URL - defaults to same host if not configured
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
const IS_DEMO = import.meta.env.VITE_DEMO_MODE === true;

// Mock Data Imports
import { mockPhotos, mockAssetMap, mockTimeline, getMockPhotoUrl, getMockSplatUrl } from './mockData';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Mock Adapter Logic
if (IS_DEMO) {
  console.log('🚧 RUNNING IN DEMO MODE 🚧');
  
  // Intercept requests
  api.interceptors.request.use(async (config) => {
    // Return mock responses strictly for demo
    // We throw an axios error with response data to be caught by the interceptor below?
    // Actually simpler to just have wrapper functions check IS_DEMO or hijack the adapter.
    return config;
  });
}

/**
 * Get media processing status (list of all media items)
 */
export const getMediaStatus = async () => {
    if (IS_DEMO) return [];
  const response = await api.get('/media/status');
  return response.data;
};

/**
 * Get media depth map
 * @param {string|number} mediaItemId - The media item ID
 * @returns {Promise<Blob>} - Depth map image blob
 */
export const getMediaDepth = async (mediaItemId) => {
    // No depth in demo for now, or use placeholder
    if (IS_DEMO) {
        // Return logging or empty blob
        return new Blob([], { type: 'image/jpeg' });
    }
  const response = await api.get(`/media/${mediaItemId}/depth`, {
    responseType: 'blob',
  });
  return response.data;
};

/**
 * Get media depth map info (metadata)
 * @param {string|number} mediaItemId - The media item ID
 */
/**
 * Get media depth map info (metadata)
 * @param {string|number} mediaItemId - The media item ID
 */
export const getMediaDepthInfo = async (mediaItemId) => {
  if (IS_DEMO) return {};
  const response = await api.get(`/media/${mediaItemId}/depth/info`);
  return response.data;
};

/**
 * Get Immich assets (if Immich is configured)
 * @param {Object} params - Query parameters
 */
/**
 * Get Immich assets (if Immich is configured)
 * @param {Object} params - Query parameters
 */
export const getImmichAssets = async (params = {}) => {
  if (IS_DEMO) return mockPhotos;
  const response = await api.get('/immich/assets', { params });
  return response.data;
};

/**
 * Get Immich photos with pagination
 * @param {number} page - Page number (0-indexed)
 * @param {number} size - Number of photos per page
 */
/**
 * Get Immich photos with pagination
 * @param {number} page - Page number (0-indexed)
 * @param {number} size - Number of photos per page
 */
export const getImmichPhotos = async (page = 0, size = 100) => {
  if (IS_DEMO) return mockPhotos;
  const response = await api.get('/immich/photos', {
    params: { page, size }
  });
  return response.data;
};

/**
 * Get Immich photos that have processed 3D assets (Splats)
 * @param {number} page - Page number
 * @param {number} size - Page size
 */
/**
 * Get Immich photos that have processed 3D assets (Splats)
 * @param {number} page - Page number
 * @param {number} size - Page size
 */
export const getProcessedPhotos = async (page = 0, size = 100) => {
  if (IS_DEMO) return mockPhotos;
  const response = await api.get('/immich/processed', {
    params: { page, size, type: 'all' }
  });
  return response.data;
};

/**
 * Get Immich timeline buckets
 */
/**
 * Get Immich timeline buckets
 */
export const getImmichTimeline = async () => {
    if (IS_DEMO) return mockTimeline;
  const response = await api.get('/immich/timeline');
  return response.data;
};

/**
 * Get Immich assets for a specific timeline bucket
 * @param {string} bucket - Bucket identifier
 */
/**
 * Get Immich assets for a specific timeline bucket
 * @param {string} bucket - Bucket identifier
 */
export const getImmichBucket = async (bucket) => {
    if (IS_DEMO) return mockPhotos;
  const response = await api.get(`/immich/timeline/${encodeURIComponent(bucket)}`);
  return response.data;
};

/**
 * Get Immich asset thumbnail
 * @param {string} assetId - The asset ID
 * @returns {Promise<Blob>} - Thumbnail image blob
 */
/**
 * Get Immich asset thumbnail
 * @param {string} assetId - The asset ID
 * @returns {Promise<Blob>} - Thumbnail image blob
 */
export const getImmichThumbnail = async (assetId) => {
    if (IS_DEMO) {
        const url = getMockPhotoUrl(assetId);
        const res = await fetch(url);
        return await res.blob();
    }
  const response = await api.get(`/immich/assets/${assetId}/thumbnail`, {
    responseType: 'blob',
  });
  return response.data;
};

/**
 * Get Immich asset file (full resolution)
 * @param {string} assetId - The asset ID
 * @returns {Promise<Blob>} - Full resolution image blob
 */
/**
 * Get Immich asset file (full resolution)
 * @param {string} assetId - The asset ID
 * @returns {Promise<Blob>} - Full resolution image blob
 */
export const getImmichFile = async (assetId) => {
    if (IS_DEMO) {
        const url = getMockPhotoUrl(assetId);
        const res = await fetch(url);
        return await res.blob();
    }
  const response = await api.get(`/immich/assets/${assetId}/file`, {
    responseType: 'blob',
  });
  return response.data;
};

/**
 * Generate depth map for an Immich photo
 * @param {string} assetId - The asset ID
 * @returns {Promise<Blob>} - Depth map image blob
 */
/**
 * Generate depth map for an Immich photo
 * @param {string} assetId - The asset ID
 * @returns {Promise<Blob>} - Depth map image blob
 */
export const generateImmichDepth = async (assetId) => {
    if (IS_DEMO) throw new Error("Not available in Demo Mode");
  const response = await api.post(`/immich/assets/${assetId}/depth`, {}, {
    responseType: 'blob',
    timeout: 120000, // 2 minutes for depth processing
  });
  return response.data;
};

/**
 * Upload media file
 * @param {File} file - The file to upload
 * @param {Function} onProgress - Progress callback
 */
export const uploadMedia = async (file, onProgress) => {
  const formData = new FormData();
  formData.append('media', file);

  const response = await api.post('/media/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        onProgress(percentCompleted);
      }
    },
  });

  return response.data;
};

/**
 * Check backend health
 */
export const checkHealth = async () => {
  const response = await api.get('/health');
  return response.data;
};

// ============================================================================
// SETTINGS API
// ============================================================================

/**
 * Get user settings (default model, auto-generate preference)
 */
/**
 * Get user settings (default model, auto-generate preference)
 */
export const getSettings = async () => {
    if (IS_DEMO) return { defaultModel: 'base', autoGenerate: false };
  const response = await api.get('/settings');
  return response.data;
};

/**
 * Update user settings
 * @param {Object} settings - Settings to update
 */
export const updateSettings = async (settings) => {
  const response = await api.put('/settings', settings);
  return response.data;
};

// ============================================================================
// MODELS API
// ============================================================================

/**
 * Get all AI models with their status from backend database
 */
/**
 * Get all AI models with their status from backend database
 */
export const getModels = async () => {
    if (IS_DEMO) return { base: { downloaded: true }, small: { downloaded: true } };
  const response = await api.get('/settings/models');
  return response.data;
};

/**
 * Get AI models status from AI service (via backend proxy)
 */
/**
 * Get AI models status from AI service (via backend proxy)
 */
export const getAIModels = async () => {
    if (IS_DEMO) return { base: 'loaded' };
  const response = await api.get('/settings/models/ai', { timeout: 10000 });
  return response.data;
};

/**
 * Load/switch to a specific model on AI service (via backend proxy)
 * @param {string} modelKey - Model to load (small, base, large)
 * @param {Object} options - Options { device: 'auto' | 'cpu' | 'gpu' }
 */
export const loadModel = async (modelKey, options = {}) => {
  const response = await api.post(`/settings/models/${modelKey}/load`, {
    device: options.device || 'auto'
  }, {
    timeout: 300000, // 5 minutes for model download
  });
  return response.data;
};

/**
 * Unload a specific model
 * @param {string} modelKey - Model key
 */
export const unloadModel = async (modelKey) => {
  const response = await api.post(`/settings/models/${modelKey}/unload`);
  return response.data;
};

/**
 * Mark a model as downloaded in database (Legacy/Fallback)
 * @param {string} modelKey - Model key
 */
export const markModelDownloaded = async (modelKey) => {
  const response = await api.post(`/settings/models/${modelKey}/download`);
  return response.data;
};

/**
 * Download a model (Disk only, no activation)
 * @param {string} modelKey - Model key
 */
export const downloadModel = async (modelKey) => {
    // This endpoint now handles the actual download process on backend+AI service
    const response = await api.post(`/settings/models/${modelKey}/download`);
    return response.data;
};

/**
 * Mark a model as not downloaded
 * @param {string} modelKey - Model key
 */
export const deleteModel = async (modelKey) => {
  const response = await api.delete(`/settings/models/${modelKey}`);
  return response.data;
};

// ============================================================================
// GENERATED ASSETS API
// ============================================================================

/**
 * Get all generated files (depth maps, splats) for a photo
 * @param {string} photoId - The photo/asset ID
 */
/**
 * Get all generated files (depth maps, splats) for a photo
 * @param {string} photoId - The photo/asset ID
 */
export const getPhotoFiles = async (photoId) => {
    if (IS_DEMO) return mockAssetMap[photoId] || {};
  const response = await api.get(`/assets/${photoId}/files`);
  return response.data;
};

/**
 * Get map of all existing assets
 * Format: { [immichId]: { depth: ['small'], splat: ['sharp'] } }
 */
/**
 * Get map of all existing assets
 * Format: { [immichId]: { depth: ['small'], splat: ['sharp'] } }
 */
export const getAssetMap = async () => {
    if (IS_DEMO) return { map: mockAssetMap };
    try {
        const response = await api.get('/assets/map');
        return response.data;
    } catch (err) { 
        return { map: {} };
    }
};

/**
 * Delete a specific generated file
 * @param {string} photoId - The photo/asset ID
 * @param {string} fileId - The file ID to delete
 */
export const deletePhotoFile = async (photoId, fileId) => {
  const response = await api.delete(`/assets/${photoId}/files/${fileId}`);
  return response.data;
};

/**
 * Generate a 3D asset (Depth, Splat, etc.)
 * @param {string} assetId - The asset ID
 * @param {string} type - "depth" or "splat"
 * @param {string} modelKey - Model key (e.g. "small", "gs-fast")
 */
/**
 * Generate a 3D asset (Depth, Splat, etc.)
 * @param {string} assetId - The asset ID
 * @param {string} type - "depth" or "splat"
 * @param {string} modelKey - Model key (e.g. "small", "gs-fast")
 */
export const generateAsset = async (assetId, type = 'depth', modelKey = 'small') => {
    if (IS_DEMO && type === 'splat') {
        const url = getMockSplatUrl(assetId);
        // We might need to return a blob or handle it differently?
        // Actually generateAsset usually returns the blob in the real app if responseType is blob
        // But for SPLAT, the viewer usually loads it directly via URL.
        // Wait, the viewer calls getPhotoFiles to see if it exists, then MIGHT load it via a direct URL constructed in component or via fetching blob?
        // GaussianSplatViewer usually takes a url.
        // If the viewer uses api.getPhotoFiles, it gets keys.
        // If we are "generating", in demo we just return success?
        return {};
    }
    const response = await api.post(`/assets/${assetId}/generate`, { type, modelKey }, {
        responseType: 'blob', // Expecting binary (image/ply) or json depending on type
        timeout: 120000, 
    });
    // If it's depth, we get a blob. If splat, might get JSON job ID (future).
    // For now, assuming depth returns blob.
    return response.data;
};

/**
 * Generate depth for a photo with specific model (Wrapper for generateAsset)
 * @param {string} assetId - The asset ID
 * @param {string} modelKey - Model to use (small, base, large)
 * @returns {Promise<Blob>} - Depth map image blob
 */
export const generateDepthWithModel = async (assetId, modelKey = 'small') => {
  return generateAsset(assetId, 'depth', modelKey);
};

/**
 * Convert PLY to KSPLAT format
 * @param {string} assetId - The asset ID
 * @returns {Promise<Object>} - Conversion result
 */
export const convertPlyToKsplat = async (assetId) => {
  const response = await api.post(`/assets/${assetId}/convert`, { from: 'ply', to: 'ksplat' }, {
    timeout: 120000, // 2 minutes for conversion
  });
  return response.data;
};

export default api;

