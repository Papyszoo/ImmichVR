const express = require('express');
const router = express.Router();
const healthRoutes = require('./health.routes');
const aiRoutes = require('./ai.routes');
const mediaRoutes = require('./media.routes');
const queueRoutes = require('./queue.routes');
const immichRoutes = require('./immich.routes');

// Mount routes
router.use('/', healthRoutes); // Root endpoints (/ and /health)
router.use('/api/ai', aiRoutes);
router.use('/api/media', mediaRoutes);
router.use('/api/queue', queueRoutes);
router.use('/api/immich', immichRoutes);

// Database debug endpoint (legacy compatibility)
// router.use('/api/db', healthRoutes); // Handled by /api/db/info in healthRoutes

module.exports = router;
