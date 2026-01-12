const { immichConnector } = require('../services');

// Middleware to check if Immich connector is initialized
const requireImmichConnector = (req, res, next) => {
  // Check the exported instance
  if (!immichConnector) {
    return res.status(503).json({
      error: 'Immich connector not configured',
      message: 'Please set IMMICH_URL and IMMICH_API_KEY environment variables',
    });
  }
  next();
};

module.exports = requireImmichConnector;
