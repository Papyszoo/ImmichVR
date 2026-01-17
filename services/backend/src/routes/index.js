const express = require('express');
const router = express.Router();
const healthRoutes = require('./health.routes');
const aiRoutes = require('./ai.routes');
const mediaRoutes = require('./media.routes');
const queueRoutes = require('./queue.routes');
const immichRoutes = require('./immich.routes');
const assetsRoutes = require('./assets.routes');
const settingsRoutes = require('./settings.routes');

// Mount routes
router.use('/', healthRoutes); // Root endpoints (/ and /health)
router.use('/api/ai', aiRoutes);
router.use('/api/media', mediaRoutes);
router.use('/api/queue', queueRoutes);
router.use('/api/immich', immichRoutes);
router.use('/api/assets', assetsRoutes); // New generic endpoint
router.use('/api/photos', assetsRoutes); // Aliased for backward compatibility (legacy)
router.use('/api/settings', settingsRoutes);

// Database debug endpoint (legacy compatibility)
// router.use('/api/db', healthRoutes); // Handled by /api/db/info in healthRoutes

module.exports = router;

