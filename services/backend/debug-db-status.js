const pool = require('./src/config/database');

async function checkStatus() {
  try {
    const res = await pool.query('SELECT * FROM ai_models');
    console.log('AI Models Status:', JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

checkStatus();
