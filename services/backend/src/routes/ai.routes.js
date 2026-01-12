const express = require('express');
const router = express.Router();
const { apiGateway } = require('../services');

// AI Service health check proxy
router.get('/health', async (req, res) => {
  try {
    const health = await apiGateway.checkAIServiceHealth();
    if (health.healthy) {
      res.json(health.data);
    } else {
      res.status(503).json({ 
        error: 'AI service unhealthy', 
        message: health.error 
      });
    }
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to check AI service health', 
      message: error.message 
    });
  }
});

// AI Service info proxy
router.get('/info', async (req, res) => {
  try {
    const info = await apiGateway.getAIServiceInfo();
    res.json(info);
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get AI service info', 
      message: error.message 
    });
  }
});

module.exports = router;
