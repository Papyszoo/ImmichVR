const pool = require('../src/config/database');
const { immichConnector } = require('../src/services');

async function backfill() {
  console.log('Starting backfill of captured_at...');
  
  // Wait for Immich Connector to be ready
  if (!immichConnector) {
      console.error('Immich Connector not initialized. Check ENV variables.');
      // It might take a moment to initialize in some contexts, but usually it's sync after require in index.js
      // However, index.js initializes it.
      // Wait, requiring '../src/services' executes index.js which instantiates it.
  }

  try {
    const res = await pool.query("SELECT id, immich_asset_id FROM media_items WHERE captured_at IS NULL");
    
    if (res.rows.length === 0) {
        console.log('No items missing captured_at date. Database is up to date.');
        return;
    }

    console.log(`Found ${res.rows.length} items to update.`);
    
    let updated = 0;
    let failed = 0;

    for (const item of res.rows) {
        if (!item.immich_asset_id) continue;
        
        try {
            // immich_asset_id might be "immich://UUID" or just "UUID"
            const assetId = item.immich_asset_id.replace('immich://', '');
            
            // Console log progress
            process.stdout.write(`Processing ${assetId} ... `);
            
            const info = await immichConnector.getAssetInfo(assetId);
            const date = info.exifInfo?.dateTimeOriginal || info.fileCreatedAt || new Date();
            
            await pool.query('UPDATE media_items SET captured_at = $1 WHERE id = $2', [date, item.id]);
            updated++;
            console.log(`Done (${date})`);
        } catch (err) {
            console.log(`Failed: ${err.message}`);
            failed++;
        }
        
        // Small delay to be nice to API
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    console.log(`\nBackfill complete. Updated: ${updated}, Failed: ${failed}`);
  } catch (err) {
    console.error('Fatal error:', err);
  } finally {
    pool.end();
  }
}

// Allow time for DB connection to establish if needed, though pool is immediate.
backfill();
