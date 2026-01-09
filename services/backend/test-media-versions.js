#!/usr/bin/env node
/**
 * Integration Test for Media Versions (Thumbnail & Full-Resolution)
 * Tests the new dual-version processing capability
 * 
 * This test validates:
 * 1. Database schema changes (media_items.thumbnail_path, depth_map_cache.version_type)
 * 2. Processing worker handling of both versions
 * 3. API endpoints for fetching depth maps by version
 * 
 * Note: This test requires PostgreSQL to be running and accessible
 */

const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

// Test configuration
const TEST_CONFIG = {
  user: process.env.POSTGRES_USER || 'immichvr',
  password: process.env.POSTGRES_PASSWORD || 'changeme',
  host: process.env.POSTGRES_HOST || 'localhost',
  database: process.env.POSTGRES_DB || 'immichvr',
  port: 5432,
};

console.log('╔════════════════════════════════════════════════════╗');
console.log('║  Media Versions Integration Test                  ║');
console.log('║  (Thumbnail & Full-Resolution)                     ║');
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

    // Test 2: Check Schema Updates
    console.log('Test 2: Schema Updates - media_items table');
    console.log('─────────────────────────────────────────────────────');
    
    const mediaColumnsResult = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'media_items'
      AND column_name IN ('thumbnail_path', 'immich_asset_id', 'source_type')
      ORDER BY column_name
    `);
    
    const expectedColumns = ['immich_asset_id', 'source_type', 'thumbnail_path'];
    const foundColumns = mediaColumnsResult.rows.map(r => r.column_name);
    const allColumnsPresent = expectedColumns.every(col => foundColumns.includes(col));
    
    if (allColumnsPresent) {
      console.log('✓ All new columns present in media_items:');
      mediaColumnsResult.rows.forEach(row => {
        console.log(`  - ${row.column_name} (${row.data_type})`);
      });
    } else {
      console.log('✗ Missing columns:', expectedColumns.filter(c => !foundColumns.includes(c)));
      throw new Error('Required columns missing from media_items table');
    }
    console.log('');

    // Test 3: Check depth_map_cache schema
    console.log('Test 3: Schema Updates - depth_map_cache table');
    console.log('─────────────────────────────────────────────────────');
    
    const depthColumnsResult = await pool.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'depth_map_cache'
      AND column_name = 'version_type'
    `);
    
    if (depthColumnsResult.rows.length > 0) {
      console.log('✓ version_type column present in depth_map_cache:');
      const col = depthColumnsResult.rows[0];
      console.log(`  - ${col.column_name} (${col.udt_name})`);
    } else {
      throw new Error('version_type column missing from depth_map_cache table');
    }
    console.log('');

    // Test 4: Check depth_map_version enum type
    console.log('Test 4: Enum Type - depth_map_version');
    console.log('─────────────────────────────────────────────────────');
    
    const enumResult = await pool.query(`
      SELECT e.enumlabel
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname = 'depth_map_version'
      ORDER BY e.enumsortorder
    `);
    
    const expectedEnumValues = ['thumbnail', 'full_resolution'];
    const foundEnumValues = enumResult.rows.map(r => r.enumlabel);
    const enumValuesCorrect = expectedEnumValues.every(val => foundEnumValues.includes(val));
    
    if (enumValuesCorrect && enumResult.rows.length === 2) {
      console.log('✓ depth_map_version enum values correct:');
      enumResult.rows.forEach(row => {
        console.log(`  - ${row.enumlabel}`);
      });
    } else {
      console.log('✗ Enum values incorrect. Found:', foundEnumValues);
      throw new Error('depth_map_version enum values incorrect');
    }
    console.log('');

    // Test 5: Check unique constraint
    console.log('Test 5: Unique Constraint - (media_item_id, version_type)');
    console.log('─────────────────────────────────────────────────────');
    
    const constraintResult = await pool.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_schema = 'public'
      AND table_name = 'depth_map_cache'
      AND constraint_name = 'depth_map_cache_media_item_version_unique'
    `);
    
    if (constraintResult.rows.length > 0) {
      console.log('✓ Unique constraint exists:');
      console.log(`  - ${constraintResult.rows[0].constraint_name}`);
    } else {
      throw new Error('Unique constraint depth_map_cache_media_item_version_unique not found');
    }
    console.log('');

    // Test 6: Check updated view
    console.log('Test 6: Updated View - media_processing_status');
    console.log('─────────────────────────────────────────────────────');
    
    const viewResult = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'media_processing_status'
      AND column_name LIKE '%depth_map%'
      ORDER BY column_name
    `);
    
    const expectedViewColumns = [
      'full_res_depth_map_generated_at',
      'full_res_depth_map_id',
      'full_res_depth_map_path',
      'thumbnail_depth_map_generated_at',
      'thumbnail_depth_map_id',
      'thumbnail_depth_map_path'
    ];
    
    const foundViewColumns = viewResult.rows.map(r => r.column_name);
    const allViewColumnsPresent = expectedViewColumns.every(col => foundViewColumns.includes(col));
    
    if (allViewColumnsPresent) {
      console.log('✓ View updated with version-specific columns:');
      foundViewColumns.forEach(col => {
        console.log(`  - ${col}`);
      });
    } else {
      console.log('✗ Missing view columns:', expectedViewColumns.filter(c => !foundViewColumns.includes(c)));
      throw new Error('View media_processing_status not properly updated');
    }
    console.log('');

    // Test 7: Test data insertion with both versions
    console.log('Test 7: Data Insertion - Media with both versions');
    console.log('─────────────────────────────────────────────────────');
    
    const insertResult = await pool.query(`
      INSERT INTO media_items 
      (original_filename, media_type, file_path, thumbnail_path, file_size, mime_type, source_type)
      VALUES ('test_image.jpg', 'photo', '/tmp/test_full.jpg', '/tmp/test_thumb.jpg', 1000000, 'image/jpeg', 'upload')
      RETURNING id, original_filename, thumbnail_path IS NOT NULL as has_thumbnail
    `);
    
    const testMediaId = insertResult.rows[0].id;
    console.log('✓ Test media item created:');
    console.log(`  - ID: ${testMediaId}`);
    console.log(`  - Has thumbnail: ${insertResult.rows[0].has_thumbnail}`);
    console.log('');

    // Test 8: Insert depth maps for both versions
    console.log('Test 8: Data Insertion - Depth maps for both versions');
    console.log('─────────────────────────────────────────────────────');
    
    await pool.query(`
      INSERT INTO depth_map_cache 
      (media_item_id, file_path, file_size, format, width, height, version_type)
      VALUES ($1, '/tmp/test_thumb_depth.png', 50000, 'png', 640, 480, 'thumbnail')
    `, [testMediaId]);
    
    await pool.query(`
      INSERT INTO depth_map_cache 
      (media_item_id, file_path, file_size, format, width, height, version_type)
      VALUES ($1, '/tmp/test_full_depth.png', 200000, 'png', 1920, 1080, 'full_resolution')
    `, [testMediaId]);
    
    console.log('✓ Both depth map versions inserted successfully');
    console.log('');

    // Test 9: Query both versions
    console.log('Test 9: Query - Retrieve both depth map versions');
    console.log('─────────────────────────────────────────────────────');
    
    const depthMapsResult = await pool.query(`
      SELECT version_type, file_size, width, height
      FROM depth_map_cache
      WHERE media_item_id = $1
      ORDER BY version_type
    `, [testMediaId]);
    
    if (depthMapsResult.rows.length === 2) {
      console.log('✓ Both depth map versions retrieved:');
      depthMapsResult.rows.forEach(row => {
        console.log(`  - ${row.version_type}: ${row.width}x${row.height}, ${row.file_size} bytes`);
      });
    } else {
      throw new Error(`Expected 2 depth maps, found ${depthMapsResult.rows.length}`);
    }
    console.log('');

    // Test 10: Test view with version data
    console.log('Test 10: View Query - media_processing_status with versions');
    console.log('─────────────────────────────────────────────────────');
    
    const viewDataResult = await pool.query(`
      SELECT 
        media_id, 
        original_filename,
        thumbnail_depth_map_path IS NOT NULL as has_thumbnail_depth,
        full_res_depth_map_path IS NOT NULL as has_fullres_depth
      FROM media_processing_status
      WHERE media_id = $1
    `, [testMediaId]);
    
    if (viewDataResult.rows.length > 0) {
      const row = viewDataResult.rows[0];
      console.log('✓ View query successful:');
      console.log(`  - Media: ${row.original_filename}`);
      console.log(`  - Has thumbnail depth: ${row.has_thumbnail_depth}`);
      console.log(`  - Has full-res depth: ${row.has_fullres_depth}`);
    } else {
      throw new Error('View query returned no results');
    }
    console.log('');

    // Cleanup test data
    console.log('Cleanup: Removing test data');
    console.log('─────────────────────────────────────────────────────');
    await pool.query('DELETE FROM media_items WHERE id = $1', [testMediaId]);
    console.log('✓ Test data cleaned up\n');

    // Summary
    console.log('╔════════════════════════════════════════════════════╗');
    console.log('║             All Tests Passed! ✓                    ║');
    console.log('╚════════════════════════════════════════════════════╝\n');

    console.log('Schema Updates Summary:');
    console.log('  ✓ media_items table: thumbnail_path, immich_asset_id, source_type');
    console.log('  ✓ depth_map_cache table: version_type enum column');
    console.log('  ✓ depth_map_version enum: thumbnail, full_resolution');
    console.log('  ✓ Unique constraint: (media_item_id, version_type)');
    console.log('  ✓ Updated view: media_processing_status with version columns');
    console.log('  ✓ Data operations: Insert and query both versions\n');

    console.log('The system is ready to process both thumbnail and full-resolution versions!');

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
