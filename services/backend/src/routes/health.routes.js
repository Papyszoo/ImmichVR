const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { apiGateway } = require('../services');

// Health check
router.get('/health', async (req, res) => {
  try {
    // Check database connectivity
    const result = await pool.query('SELECT 1 as health_check');
    res.json({ 
      status: 'healthy', 
      service: 'backend',
      database: 'connected'
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'unhealthy', 
      service: 'backend',
      database: 'disconnected',
      error: error.message
    });
  }
});

// Root endpoint
router.get('/', (req, res) => {
  res.json({ message: 'ImmichVR Backend Service', version: '1.0.0' });
});

// Database schema info
router.get('/api/db/info', async (req, res) => {
  try {
    const tablesQuery = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    const viewsQuery = await pool.query(`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    res.json({
      database: process.env.POSTGRES_DB || 'immichvr',
      tables: tablesQuery.rows.map(r => r.table_name),
      views: viewsQuery.rows.map(r => r.table_name),
      status: 'connected'
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Database query failed', 
      message: error.message 
    });
  }
});

module.exports = router;
