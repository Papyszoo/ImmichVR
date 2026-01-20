/**
 * API Gateway
 * Routes requests between frontend, backend, and AI service
 * Handles communication with the AI service for depth map processing
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

class APIGateway {
  constructor(aiServiceUrl) {
    this.aiServiceUrl = aiServiceUrl;
    this.aiClient = axios.create({
      baseURL: aiServiceUrl,
      timeout: 120000, // 2 minutes for AI processing
      validateStatus: () => true, // Don't throw on any status code, handle in calling code
    });
  }

  /**
   * Check if AI service is healthy
   */
  async checkAIServiceHealth() {
    try {
      const response = await this.aiClient.get('/health');
      return {
        healthy: response.status === 200,
        data: response.data
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }

  /**
   * Process a media file through the AI service
   * @param {string} filePath - Path to the media file
   * @returns {Promise<Buffer>} - Depth map image buffer
   */
  async processDepthMap(filePath) {
    try {
      // Create form data
      const formData = new FormData();
      formData.append('image', fs.createReadStream(filePath));

      // Send to AI service
      const response = await this.aiClient.post('/api/depth', formData, {
        headers: {
          ...formData.getHeaders()
        },
        responseType: 'arraybuffer'
      });

      if (response.status !== 200) {
        throw new Error(`AI service returned status ${response.status}`);
      }

      return Buffer.from(response.data);

    } catch (error) {
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        throw new Error(`AI service error: ${error.response.status} - ${error.response.statusText}`);
      } else if (error.request) {
        // The request was made but no response was received
        throw new Error('No response from AI service - service may be down');
      } else {
        // Something happened in setting up the request
        throw new Error(`Request setup error: ${error.message}`);
      }
    }
  }

  /**
   * Get AI service information
   */
  async getAIServiceInfo() {
    try {
      const response = await this.aiClient.get('/');
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get AI service info: ${error.message}`);
    }
  }

  /**
   * Process video depth map (experimental)
   * @param {string} videoPath - Path to the video file
   * @param {number} fps - Frames per second to extract
   * @param {number} maxFrames - Maximum number of frames to extract
   * @param {string} method - Extraction method ('interval' or 'keyframes')
   * @returns {Promise<Buffer>} - ZIP file containing depth map frames
   */
  async processVideoDepthMap(videoPath, fps = 1, maxFrames = 30, method = 'interval') {
    try {
      // Create form data
      const formData = new FormData();
      formData.append('video', fs.createReadStream(videoPath));

      // Send to AI service with query parameters
      const response = await this.aiClient.post('/api/video/depth', formData, {
        params: {
          fps,
          max_frames: maxFrames,
          method,
          output_format: 'zip'
        },
        headers: {
          ...formData.getHeaders()
        },
        responseType: 'arraybuffer',
        timeout: 300000 // 5 minutes for video processing
      });

      if (response.status !== 200) {
        throw new Error(`AI service returned status ${response.status}`);
      }

      return Buffer.from(response.data);

    } catch (error) {
      if (error.response) {
        throw new Error(`AI service error: ${error.response.status} - ${error.response.statusText}`);
      } else if (error.request) {
        throw new Error('No response from AI service - service may be down');
      } else {
        throw new Error(`Request setup error: ${error.message}`);
      }
    }
  }

  /**
   * Process video to Side-by-Side 3D format (experimental)
   * @param {string} videoPath - Path to the video file
   * @param {number} divergence - Strength of 3D effect (default: 2.0)
   * @param {string} sbsFormat - 'SBS_FULL' or 'SBS_HALF' (default: 'SBS_FULL')
   * @param {string} codec - 'h264' or 'hevc' (default: 'h264')
   * @param {number} batchSize - Frames to process at once for VRAM management (default: 10)
   * @returns {Promise<Buffer>} - SBS video file as buffer
   */
  async processVideoSBS(videoPath, divergence = 2.0, sbsFormat = 'SBS_FULL', codec = 'h264', batchSize = 10) {
    try {
      // Create form data
      const formData = new FormData();
      formData.append('video', fs.createReadStream(videoPath));

      // Send to AI service with query parameters
      const response = await this.aiClient.post('/api/video/sbs', formData, {
        params: {
          divergence,
          format: sbsFormat,
          codec,
          batch_size: batchSize
        },
        headers: {
          ...formData.getHeaders()
        },
        responseType: 'arraybuffer',
        timeout: 900000 // 15 minutes for SBS video processing (longer than depth-only)
      });

      if (response.status !== 200) {
        throw new Error(`AI service returned status ${response.status}`);
      }

      return Buffer.from(response.data);

    } catch (error) {
      if (error.response) {
        throw new Error(`AI service error: ${error.response.status} - ${error.response.statusText}`);
      } else if (error.request) {
        throw new Error('No response from AI service - service may be down');
      } else {
        throw new Error(`Request setup error: ${error.message}`);
      }
    }
  }

  /**
   * Unload the current model from memory
   */
  /**
   * Unload the current model from memory
   * @param {string} modelKey - The model key to unload
   */
  async unloadModel(modelKey) {
    if (!modelKey) {
        throw new Error("unloadModel requires a modelKey");
    }
    try {
      const response = await this.aiClient.post(`/api/models/${modelKey}/unload`);
      if (response.status !== 200) {
        throw new Error(`AI service returned status ${response.status}`);
      }
      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 404) {
         // Fallback if specific unload endpoint missing? No, we just added it.
         console.warn(`AI service returned 404 for unload ${modelKey}`);
         return { success: false, message: 'Unload endpoint not found' };
      }
      throw new Error(`Failed to unload model: ${error.message}`);
    }
  }

  /**
   * Get currently loaded model from AI service
   */
  async getLoadedModel() {
    try {
      const response = await this.aiClient.get('/api/models/current');
      if (response.status !== 200) {
        throw new Error(`AI service returned status ${response.status}`);
      }
      return response.data; // Expected: { current_model: 'small' | null }
    } catch (error) {
      throw new Error(`Failed to get loaded model: ${error.message}`);
    }
  }

  /**
   * Download a model (disk only, no load)
   */
  async downloadModel(modelKey) {
     try {
      const response = await this.aiClient.post(`/api/models/${modelKey}/download`);
      if (response.status !== 200) {
        throw new Error(`AI service returned status ${response.status}`);
      }
      return response.data;
    } catch (error) {
        // Fallback for older AI service versions? 
        // No, we want to fail if download-only isn't supported, 
        // otherwise we regress to "loading" which is what we want to avoid.
       throw new Error(`Failed to download model ${modelKey}: ${error.message}`);
    }
  }

  /**
   * Load a specific model
   * @param {string} modelKey
   * @param {Object} options - { device: 'auto'|'cpu'|'gpu' }
   */
  async loadModel(modelKey, options = {}) {
     try {
      const response = await this.aiClient.post(`/api/models/${modelKey}/load`, options);
      if (response.status !== 200) {
        throw new Error(`AI service returned status ${response.status}`);
      }
      return response.data;
    } catch (error) {
       throw new Error(`Failed to load model ${modelKey}: ${error.message}`);
    }
  }

  /**
   * Route request to AI service (generic proxy)
   */
  async proxyToAIService(path, method = 'GET', data = null, headers = {}) {
    try {
      const config = {
        method,
        url: path,
        headers
      };

      if (data) {
        config.data = data;
      }

      const response = await this.aiClient.request(config);
      return {
        status: response.status,
        data: response.data,
        headers: response.headers
      };
    } catch (error) {
      throw new Error(`AI service proxy error: ${error.message}`);
    }
  }
}

module.exports = APIGateway;
