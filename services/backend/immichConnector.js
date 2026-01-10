/**
 * Immich Connector Module
 * 
 * Provides secure connection to a local Immich instance to fetch photos and videos
 * metadata and files for depth processing.
 * 
 * Features:
 * - Secure API key authentication
 * - Fetch media metadata (photos and videos)
 * - Fetch thumbnail and full-resolution files
 * - Comprehensive error handling
 * - Configuration via environment variables
 */

const axios = require('axios');

class ImmichConnector {
  /**
   * Initialize the Immich connector
   * @param {Object} config - Configuration object
   * @param {string} config.url - Immich instance URL
   * @param {string} config.apiKey - Immich API key
   */
  constructor(config = {}) {
    this.baseUrl = config.url || process.env.IMMICH_URL;
    this.apiKey = config.apiKey || process.env.IMMICH_API_KEY;

    if (!this.baseUrl) {
      throw new Error('Immich URL is required. Set IMMICH_URL environment variable or pass url in config.');
    }

    if (!this.apiKey) {
      throw new Error('Immich API key is required. Set IMMICH_API_KEY environment variable or pass apiKey in config.');
    }

    // Remove trailing slash from base URL if present
    this.baseUrl = this.baseUrl.replace(/\/$/, '');

    // Create axios instance with default configuration
    // The Immich API endpoints are relative to /api
    this.client = axios.create({
      baseURL: `${this.baseUrl}/api`,
      headers: {
        'x-api-key': this.apiKey,
        'Accept': 'application/json',
      },
      timeout: 30000, // 30 seconds timeout
    });

    // Add request interceptor for logging (optional, can be disabled in production)
    this.client.interceptors.request.use(
      (config) => {
        // console.log(`Immich API Request: ${config.method.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        return Promise.reject(this._handleError(error));
      }
    );
  }

  /**
   * Handle and format errors from Immich API
   * @private
   */
  _handleError(error) {
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;
      return new Error(
        `Immich API error (${status}): ${data.message || data.error || JSON.stringify(data)}`
      );
    } else if (error.request) {
      // Request made but no response received
      return new Error(
        `Immich connection failed: No response from ${this.baseUrl}. Check if Immich is running and URL is correct.`
      );
    } else {
      // Error in request setup
      return new Error(`Immich request error: ${error.message}`);
    }
  }

  /**
   * Test connection to Immich instance
   * @returns {Promise<Object>} Server info
   */
  async testConnection() {
    try {
      // Immich v2 uses /server/ping instead of /api/server-info/ping
      const response = await this.client.get('/server/ping');
      return {
        connected: true,
        response: response.data,
      };
    } catch (error) {
      throw new Error(`Connection test failed: ${error.message}`);
    }
  }

  /**
   * Get server version information
   * @returns {Promise<Object>} Server version details
   */
  async getServerVersion() {
    try {
      // Immich v2 uses /server/version instead of /api/server-info/version
      const response = await this.client.get('/server/version');
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get server version: ${error.message}`);
    }
  }

  /**
   * Fetch all assets (photos and videos) with pagination support
   * @param {Object} options - Query options
   * @param {number} options.size - Number of items per page (default: 1000)
   * @param {number} options.page - Page number (default: 0)
   * @param {boolean} options.isFavorite - Filter by favorite status
   * @param {boolean} options.isArchived - Filter by archived status (default: false)
   * @param {string} options.type - Asset type filter ('IMAGE', 'VIDEO', or undefined for all)
   * @returns {Promise<Array>} Array of asset metadata
   */
  async getAssets(options = {}) {
    try {
      // Immich v2.0+ uses POST /search/metadata instead of GET /api/asset
      const searchData = {
        size: options.size || 1000,
        page: options.page || 1, // v2 API uses 1-based pagination
      };

      // Add optional filters
      if (options.isFavorite !== undefined) {
        searchData.isFavorite = options.isFavorite;
      }
      if (options.isArchived !== undefined) {
        searchData.isArchived = options.isArchived;
      } else {
        searchData.isArchived = false; // Default to non-archived
      }
      if (options.type) {
        searchData.type = options.type;
      }

      const response = await this.client.post('/search/metadata', searchData);
      // v2 API returns { assets: { items: [...], total: n, count: n } }
      return response.data.assets?.items || [];
    } catch (error) {
      throw new Error(`Failed to fetch assets: ${error.message}`);
    }
  }

  /**
   * Get detailed information about a specific asset
   * @param {string} assetId - Asset ID
   * @returns {Promise<Object>} Asset details
   */
  async getAssetInfo(assetId) {
    try {
      // Immich v2 uses /assets/:id instead of /api/asset/assetById/:id
      const response = await this.client.get(`/assets/${assetId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch asset info for ${assetId}: ${error.message}`);
    }
  }

  /**
   * Fetch thumbnail for an asset
   * @param {string} assetId - Asset ID
   * @param {Object} options - Thumbnail options
   * @param {string} options.format - Image format ('JPEG' or 'WEBP', default: 'JPEG')
   * @param {string} options.size - Thumbnail size ('preview' or 'thumbnail', default: 'preview')
   * @returns {Promise<Buffer>} Thumbnail image buffer
   */
  async getThumbnail(assetId, options = {}) {
    try {
      const params = {
        format: options.format || 'JPEG',
        size: options.size || 'preview',
      };

      // Immich v2 uses /assets/:id/thumbnail instead of /api/asset/thumbnail/:id
      const response = await this.client.get(`/assets/${assetId}/thumbnail`, {
        params,
        responseType: 'arraybuffer',
      });

      return Buffer.from(response.data);
    } catch (error) {
      throw new Error(`Failed to fetch thumbnail for ${assetId}: ${error.message}`);
    }
  }

  /**
   * Download full-resolution file for an asset
   * @param {string} assetId - Asset ID
   * @returns {Promise<Buffer>} Full-resolution file buffer
   */
  async getFullResolutionFile(assetId) {
    try {
      // Immich v2 uses /assets/:id/original instead of /api/asset/file/:id
      const response = await this.client.get(`/assets/${assetId}/original`, {
        responseType: 'arraybuffer',
      });

      return Buffer.from(response.data);
    } catch (error) {
      throw new Error(`Failed to fetch full-resolution file for ${assetId}: ${error.message}`);
    }
  }

  /**
   * Stream full-resolution file for an asset (memory efficient for large files)
   * @param {string} assetId - Asset ID
   * @returns {Promise<stream.Readable>} Readable stream of the file
   */
  async streamFullResolutionFile(assetId) {
    try {
      // Immich v2 uses /assets/:id/original instead of /api/asset/file/:id
      const response = await this.client.get(`/assets/${assetId}/original`, {
        responseType: 'stream',
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to stream full-resolution file for ${assetId}: ${error.message}`);
    }
  }

  /**
   * Get statistics about the assets
   * @returns {Promise<Object>} Asset statistics
   */
  async getAssetStatistics() {
    try {
      // Immich v2 uses /search/statistics instead of /api/asset/statistics
      const response = await this.client.post('/search/statistics', {});
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch asset statistics: ${error.message}`);
    }
  }

  /**
   * Search for assets by metadata
   * @param {Object} searchCriteria - Search parameters
   * @param {string} searchCriteria.query - Search query string
   * @param {string} searchCriteria.type - Asset type filter ('IMAGE', 'VIDEO', or 'ALL')
   * @param {number} searchCriteria.size - Number of results (default: 100)
   * @returns {Promise<Array>} Array of matching assets
   */
  async searchAssets(searchCriteria = {}) {
    try {
      const searchData = {
        q: searchCriteria.query || '',
        type: searchCriteria.type || 'ALL',
        size: searchCriteria.size || 100,
      };

      const response = await this.client.post('/api/search/metadata', searchData);
      return response.data.assets?.items || [];
    } catch (error) {
      throw new Error(`Failed to search assets: ${error.message}`);
    }
  }

  /**
   * Get all photos (filtered assets)
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of photo metadata
   */
  async getPhotos(options = {}) {
    try {
      const assets = await this.getAssets(options);
      // Filter to only include photos (type === 'IMAGE')
      return assets.filter(asset => asset.type === 'IMAGE');
    } catch (error) {
      throw new Error(`Failed to fetch photos: ${error.message}`);
    }
  }

  /**
   * Get all videos (filtered assets)
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of video metadata
   */
  async getVideos(options = {}) {
    try {
      const assets = await this.getAssets(options);
      // Filter to only include videos (type === 'VIDEO')
      return assets.filter(asset => asset.type === 'VIDEO');
    } catch (error) {
      throw new Error(`Failed to fetch videos: ${error.message}`);
    }
  }
}

module.exports = ImmichConnector;
