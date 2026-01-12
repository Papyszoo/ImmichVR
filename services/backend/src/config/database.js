const { Pool } = require('pg');

// Database connection pool
const pool = new Pool({
  user: process.env.POSTGRES_USER || 'immichvr',
  password: process.env.POSTGRES_PASSWORD || 'changeme',
  host: process.env.POSTGRES_HOST || 'db',
  database: process.env.POSTGRES_DB || 'immichvr',
  port: 5432,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test database connection on startup
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connected successfully at:', res.rows[0].now);
  }
});

module.exports = pool;
