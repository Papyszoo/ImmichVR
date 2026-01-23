const ImmichConnector = require('./immichConnector');
const QueueManager = require('./queueManager');
const APIGateway = require('./apiGateway');
const ProcessingWorker = require('./processingWorker');
const dbInit = require('./dbInit');
const pool = require('../config/database');

// Initialize API Gateway
const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://ai:5000';
const apiGateway = new APIGateway(aiServiceUrl);
console.log(`API Gateway initialized with AI service URL: ${aiServiceUrl}`);

// Initialize Queue Manager
// Note: queueManager module exports a singleton instance now
const queueManager = require('./queueManager');
console.log('Queue Manager initialized (In-Memory)');

// Initialize Model Manager
const ModelManager = require('./modelManager');
const modelManager = new ModelManager(apiGateway, pool);
console.log('Model Manager initialized');

// Initialize Processing Worker
const processingWorker = new ProcessingWorker(queueManager, apiGateway, pool, modelManager);

// Initialize Immich Connector
let immichConnector = null;
try {
  if (process.env.IMMICH_URL && process.env.IMMICH_API_KEY) {
    immichConnector = new ImmichConnector({
      url: process.env.IMMICH_URL,
      apiKey: process.env.IMMICH_API_KEY,
    });
    console.log('Immich connector initialized successfully');
  } else {
    console.log('Immich connector not initialized: IMMICH_URL or IMMICH_API_KEY not configured');
  }
} catch (error) {
  console.error('Failed to initialize Immich connector:', error.message);
}

module.exports = {
  apiGateway,
  queueManager,
  processingWorker,
  processingWorker,
  immichConnector,
  modelManager,
  dbInit,
  // Helper to get fresh connector if needed (though it's usually static config)
  getImmichConnector: () => immichConnector
};
