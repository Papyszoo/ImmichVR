const express = require('express');
const routes = require('./routes'); // Aggregator

const app = express();

// Middleware
app.use(express.json());

// Routes
app.use('/', routes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

module.exports = app;
