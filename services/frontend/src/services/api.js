import axios from 'axios';

// Backend API base URL - defaults to same host if not configured
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Get media processing status (list of all media items)
 */
export const getMediaStatus = async () => {
  const response = await api.get('/media/status');
  return response.data;
};

/**
 * Get media depth map
 * @param {string|number} mediaItemId - The media item ID
 * @returns {Promise<Blob>} - Depth map image blob
 */
export const getMediaDepth = async (mediaItemId) => {
  const response = await api.get(`/media/${mediaItemId}/depth`, {
    responseType: 'blob',
  });
  return response.data;
};

/**
 * Get media depth map info (metadata)
 * @param {string|number} mediaItemId - The media item ID
 */
export const getMediaDepthInfo = async (mediaItemId) => {
  const response = await api.get(`/media/${mediaItemId}/depth/info`);
  return response.data;
};

/**
 * Get Immich assets (if Immich is configured)
 * @param {Object} params - Query parameters
 */
export const getImmichAssets = async (params = {}) => {
  const response = await api.get('/immich/assets', { params });
  return response.data;
};

/**
 * Get Immich photos
 */
export const getImmichPhotos = async () => {
  const response = await api.get('/immich/photos');
  return response.data;
};

/**
 * Get Immich asset thumbnail
 * @param {string} assetId - The asset ID
 * @returns {Promise<Blob>} - Thumbnail image blob
 */
export const getImmichThumbnail = async (assetId) => {
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
export const getImmichFile = async (assetId) => {
  const response = await api.get(`/immich/assets/${assetId}/file`, {
    responseType: 'blob',
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

export default api;
