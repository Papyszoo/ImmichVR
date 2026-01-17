#!/usr/bin/env node
/**
 * Integration Test for Generated Assets (3D)
 * Tests the new generic asset schema
 * 
 * This test validates:
 * 1. Database schema changes (generated_assets_3d table)
 * 2. ai_models updates (type column)
 * 3. View updates (media_processing_status)
 * 4. Data insertion for multiple asset types
 * 
 * Note: This test requires PostgreSQL to be running and accessible
 */

const { Pool } = require('pg');

// Test configuration
const TEST_CONFIG = {
  user: process.env.POSTGRES_USER || 'immichvr',
  password: process.env.POSTGRES_PASSWORD || 'changeme',
  host: process.env.POSTGRES_HOST || 'localhost',
  database: process.env.POSTGRES_DB || 'immichvr',
  port: 5432,
};

console.log('╔════════════════════════════════════════════════════╗');
console.log('║  Generated Assets Integration Test                ║');
console.log('║  (Generic 3D Assets Schema)                        ║');
console.log('╚════════════════════════════════════════════════════╝\n');

async function runTests() {
  const pool = new Pool(TEST_CONFIG);

  try {
    // Test 1: Database Connection
    console.log('Test 1: Database Connection');
    console.log('─────────────────────────────────────────────────────');
    const dbResult = await pool.query('SELECT NOW()');
    console.log('✓ Database connected successfully');
    console.log(`  Time: ${dbResult.rows[0].now}\n`);

    // Test 2: Check generated_assets_3d table
    console.log('Test 2: Schema - generated_assets_3d table');
    console.log('─────────────────────────────────────────────────────');
    
    const columnsResult = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'generated_assets_3d'
      AND column_name IN ('asset_type', 'model_key', 'format', 'metadata')
      ORDER BY column_name
    `);
    
    const expectedColumns = ['asset_type', 'format', 'metadata', 'model_key'];
    const foundColumns = columnsResult.rows.map(r => r.column_name);
    const allColumnsPresent = expectedColumns.every(col => foundColumns.includes(col));
    
    if (allColumnsPresent) {
      console.log('✓ All key columns present:');
      columnsResult.rows.forEach(row => {
        console.log(`  - ${row.column_name} (${row.data_type})`);
      });
    } else {
      console.log('✗ Missing columns:', expectedColumns.filter(c => !foundColumns.includes(c)));
      throw new Error('Required columns missing from generated_assets_3d table');
    }
    console.log('');

    // Test 3: Check ai_models updates
    console.log('Test 3: Schema - ai_models updates');
    console.log('─────────────────────────────────────────────────────');
    
    const modelColumnsResult = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'ai_models'
      AND column_name = 'type'
    `);
    
    if (modelColumnsResult.rows.length > 0) {
      console.log('✓ type column present in ai_models');
    } else {
      throw new Error('type column missing from ai_models table');
    }
    console.log('');

    // Test 4: Check unique constraint
    console.log('Test 4: Unique Constraint');
    console.log('─────────────────────────────────────────────────────');
    
    const constraintResult = await pool.query(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_schema = 'public'
      AND table_name = 'generated_assets_3d'
      AND constraint_name = 'unique_asset_version'
    `);
    
    if (constraintResult.rows.length > 0) {
      console.log('✓ Unique constraint exists: unique_asset_version');
    } else {
      throw new Error('Unique constraint unique_asset_version not found');
    }
    console.log('');

    // Test 5: Check updated view
    console.log('Test 5: View - media_processing_status');
    console.log('─────────────────────────────────────────────────────');
    
    const viewResult = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'media_processing_status'
      AND column_name IN ('asset_id', 'asset_type', 'model_key', 'format')
      ORDER BY column_name
    `);
    
    const expectedViewColumns = ['asset_id', 'asset_type', 'format', 'model_key'];
    const foundViewColumns = viewResult.rows.map(r => r.column_name);
    const allViewColumnsPresent = expectedViewColumns.every(col => foundViewColumns.includes(col));
    
    if (allViewColumnsPresent) {
      console.log('✓ View updated with new columns:');
      foundViewColumns.forEach(col => {
        console.log(`  - ${col}`);
      });
    } else {
      console.log('✗ Missing view columns:', expectedViewColumns.filter(c => !foundViewColumns.includes(c)));
      throw new Error('View media_processing_status not properly updated');
    }
    console.log('');

    // Test 6: Verify Data Insertion
    console.log('Test 6: Data Insertion - Multiple Asset Types');
    console.log('─────────────────────────────────────────────────────');
    
    // Create test media item
    const mediaInsert = await pool.query(`
      INSERT INTO media_items 
      (original_filename, media_type, file_path, file_size, mime_type, source_type, immich_asset_id)
      VALUES ('test_asset_gen.jpg', 'photo', '/tmp/test_asset_gen.jpg', 12345, 'image/jpeg', 'upload', 'test-asset-id')
      RETURNING id
    `);
    const mediaId = mediaInsert.rows[0].id;
    console.log(`  Created test media item: ${mediaId}`);

    // Insert generic depth map
    await pool.query(`
      INSERT INTO generated_assets_3d 
      (media_item_id, asset_type, model_key, format, file_path, file_size)
      VALUES ($1, 'depth', 'small', 'jpg', '/tmp/depth.jpg', 1024)
    `, [mediaId]);
    console.log('  Inserted depth asset');

    // Insert thumbnail depth map
    await pool.query(`
      INSERT INTO generated_assets_3d 
      (media_item_id, asset_type, model_key, format, file_path, file_size)
      VALUES ($1, 'depth_thumbnail', 'small', 'png', '/tmp/thumb_depth.png', 512)
    `, [mediaId]);
    console.log('  Inserted depth_thumbnail asset');

    // Insert splat (future proofing test)
    await pool.query(`
      INSERT INTO generated_assets_3d 
      (media_item_id, asset_type, model_key, format, file_path, file_size, metadata)
      VALUES ($1, 'splat', 'gs-fast', 'ply', '/tmp/model.ply', 2048, '{"points": 1000}')
    `, [mediaId]);
    console.log('  Inserted splat asset');

    // Verify retrieval
    const assets = await pool.query(`
      SELECT asset_type, model_key, format 
      FROM generated_assets_3d 
      WHERE media_item_id = $1 
      ORDER BY asset_type
    `, [mediaId]);

    if (assets.rows.length === 3) {
      console.log('✓ Retrieved all 3 inserted assets:');
      assets.rows.forEach(r => console.log(`  - ${r.asset_type} (${r.model_key}, ${r.format})`));
    } else {
      throw new Error(`Expected 3 assets, found ${assets.rows.length}`);
    }
    console.log('');

    // Cleanup
    console.log('Cleanup');
    console.log('─────────────────────────────────────────────────────');
    await pool.query('DELETE FROM media_items WHERE id = $1', [mediaId]);
    console.log('✓ Cleanup successful\n');

    // Summary
    console.log('╔════════════════════════════════════════════════════╗');
    console.log('║             All Tests Passed! ✓                    ║');
    console.log('╚════════════════════════════════════════════════════╝\n');
    
    console.log('Schema migration verified successfully.');

  } catch (error) {
    console.error('\n✗ Test failed:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
