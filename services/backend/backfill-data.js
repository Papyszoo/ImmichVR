const pool = require('./src/config/database');
const { immichConnector } = require('./src/services');

async function backfill() {
  console.log('Starting backfill of captured_at...');
  
  if (!immichConnector) {
      console.error('Immich Connector not initialized. Check ENV variables.');
      process.exit(1);
  }

  try {
    const res = await pool.query("SELECT id, immich_asset_id FROM media_items WHERE captured_at IS NULL");
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

backfill();
