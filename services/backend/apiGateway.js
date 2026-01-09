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
      validateStatus: (status) => status < 500, // Don't throw on 4xx errors
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
