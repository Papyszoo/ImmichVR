const app = require('./app');
const { processingWorker, dbInit } = require('./services');
const fs = require('fs').promises;

const PORT = process.env.BACKEND_PORT || 3000;
const uploadDir = process.env.UPLOAD_DIR || '/data/uploads';

// Start processing worker if enabled (default: true)
const autoStartWorker = process.env.AUTO_START_WORKER !== 'false';
if (autoStartWorker) {
  // Wait a bit for services to be ready, then start
  setTimeout(() => {
    console.log('Starting processing worker...');
    processingWorker.start(5000); // Check queue every 5 seconds
  }, 3000);
}

// Ensure upload directory exists
fs.mkdir(uploadDir, { recursive: true }).catch(err => {
  console.error('Failed to create upload directory - file uploads will fail:', err.message);
});

// Start server
const server = app.listen(PORT, async () => {
  console.log(`Backend service running on port ${PORT}`);
  
  // Initialize DB Schema
  await dbInit.ensureSchema();
});

// Initialize Socket.IO
const { modelManager } = require('./services');
const SocketManager = require('./services/socketManager');
const socketManager = new SocketManager(server, modelManager);
console.log('Socket Manager initialized');

// Build info
console.log('ImmichVR Backend Service v1.0.0 (Refactored)');
