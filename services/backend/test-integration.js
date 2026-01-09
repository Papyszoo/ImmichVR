#!/usr/bin/env node
/**
 * Integration Test Script for API Gateway & Queue Manager
 * Tests the queue management and priority system
 * 
 * Note: This test requires PostgreSQL to be running and accessible
 */

const { Pool } = require('pg');
const QueueManager = require('./queueManager');

// Test configuration
const TEST_CONFIG = {
  user: process.env.POSTGRES_USER || 'immichvr',
  password: process.env.POSTGRES_PASSWORD || 'changeme',
  host: process.env.POSTGRES_HOST || 'localhost',
  database: process.env.POSTGRES_DB || 'immichvr',
  port: 5432,
};

console.log('╔════════════════════════════════════════════════════╗');
console.log('║  API Gateway & Queue Manager Integration Test     ║');
console.log('╚════════════════════════════════════════════════════╝\n');

async function runTests() {
  const pool = new Pool(TEST_CONFIG);
  const queueManager = new QueueManager(pool);

  try {
    // Test 1: Database Connection
    console.log('Test 1: Database Connection');
    console.log('─────────────────────────────────────────────────────');
    const dbResult = await pool.query('SELECT NOW()');
    console.log('✓ Database connected successfully');
    console.log(`  Time: ${dbResult.rows[0].now}\n`);

    // Test 2: Check Database Schema
    console.log('Test 2: Database Schema');
    console.log('─────────────────────────────────────────────────────');
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('media_items', 'processing_queue', 'depth_map_cache')
      ORDER BY table_name
    `);
    
    const tables = tablesResult.rows.map(r => r.table_name);
    const requiredTables = ['media_items', 'processing_queue', 'depth_map_cache'];
    const allTablesPresent = requiredTables.every(t => tables.includes(t));
    
    if (allTablesPresent) {
      console.log('✓ All required tables present:');
      tables.forEach(table => console.log(`  - ${table}`));
    } else {
      console.log('✗ Missing tables:', requiredTables.filter(t => !tables.includes(t)));
      throw new Error('Required tables missing');
    }
    console.log('');

    // Test 3: Priority Calculation
    console.log('Test 3: Priority Calculation');
    console.log('─────────────────────────────────────────────────────');
    const testCases = [
      { type: 'photo', size: 1024 * 1024 },
      { type: 'photo', size: 50 * 1024 * 1024 },
      { type: 'video', size: 1024 * 1024 },
      { type: 'video', size: 50 * 1024 * 1024 },
    ];

    let priorityTestsPassed = true;
    testCases.forEach((test, i) => {
      const priority = queueManager.calculatePriority(test.type, test.size);
      const sizeInMB = (test.size / (1024 * 1024)).toFixed(2);
      const expectedRange = test.type === 'photo' ? '1-100' : '101-200';
      const inRange = test.type === 'photo' ? (priority >= 1 && priority <= 100) : (priority >= 101 && priority <= 200);
      
      console.log(`  ${test.type.padEnd(6)} ${sizeInMB.padStart(6)} MB => Priority: ${priority.toString().padStart(3)} (expected: ${expectedRange}) ${inRange ? '✓' : '✗'}`);
      
      if (!inRange) priorityTestsPassed = false;
    });

    if (priorityTestsPassed) {
      console.log('✓ All priority calculations correct\n');
    } else {
      throw new Error('Priority calculation test failed');
    }

    // Test 4: Queue Statistics
    console.log('Test 4: Queue Statistics');
    console.log('─────────────────────────────────────────────────────');
    const stats = await queueManager.getQueueStats();
    console.log('✓ Queue statistics retrieved:');
    console.log(`  - Queued: ${stats.queued}`);
    console.log(`  - Processing: ${stats.processing}`);
    console.log(`  - Completed: ${stats.completed}`);
    console.log(`  - Failed: ${stats.failed}`);
    console.log(`  - Cancelled: ${stats.cancelled}`);
    console.log(`  - Pending: ${stats.pending}`);
    console.log('');

    // Test 5: Check for existing media items
    console.log('Test 5: Existing Media Items');
    console.log('─────────────────────────────────────────────────────');
    const mediaResult = await pool.query('SELECT COUNT(*) as count FROM media_items');
    const mediaCount = parseInt(mediaResult.rows[0].count);
    console.log(`✓ Found ${mediaCount} media items in database\n`);

    // Test 6: Queue item retrieval
    console.log('Test 6: Queue Items Retrieval');
    console.log('─────────────────────────────────────────────────────');
    const queueItems = await queueManager.getQueueItems({ limit: 5 });
    console.log(`✓ Retrieved ${queueItems.length} queue items`);
    if (queueItems.length > 0) {
      console.log('  Sample queue item:');
      const sample = queueItems[0];
      console.log(`    ID: ${sample.id}`);
      console.log(`    Status: ${sample.status}`);
      console.log(`    Priority: ${sample.priority}`);
      console.log(`    Media: ${sample.original_filename} (${sample.media_type})`);
    }
    console.log('');

    // Summary
    console.log('╔════════════════════════════════════════════════════╗');
    console.log('║             All Tests Passed! ✓                    ║');
    console.log('╚════════════════════════════════════════════════════╝\n');

    console.log('Integration test completed successfully.');
    console.log('The API Gateway & Queue Manager is ready to use.\n');

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
