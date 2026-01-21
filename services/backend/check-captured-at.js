const pool = require('./src/config/database');

async function checkStatus() {
  try {
    const res = await pool.query('SELECT id, original_filename, captured_at FROM media_items');
    console.log('Media Items Captured At Status:', JSON.stringify(res.rows, null, 2));
    
    const countNull = res.rows.filter(r => r.captured_at === null).length;
    console.log(`\nTotal: ${res.rows.length}, Null captured_at: ${countNull}`);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

checkStatus();
