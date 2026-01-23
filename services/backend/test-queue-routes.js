#!/usr/bin/env node
/**
 * Integration Test Script for Queue Management Routes
 * Tests queue operations, worker control, and status monitoring
 * 
 * Note: This test requires PostgreSQL to be running
 */

const axios = require('axios');

const BASE_URL = process.env.BACKEND_URL || 'http://localhost:3000';

console.log('╔════════════════════════════════════════════════════╗');
console.log('║  Queue Management Integration Test                ║');
console.log('╚════════════════════════════════════════════════════╝\n');

async function runTests() {
  let testsPassed = 0;
  let testsFailed = 0;

  try {
    // Test 1: Get Queue Summary
    console.log('Test 1: Get Queue Summary');
    console.log('─────────────────────────────────────────────────────');
    try {
      const response = await axios.get(`${BASE_URL}/api/queue/summary`);
      if (response.status === 200 && response.data.summary) {
        console.log('✓ Queue summary retrieved successfully');
        console.log(`  Summary items: ${response.data.summary.length}`);
        testsPassed++;
      } else {
        console.log('✗ Unexpected response:', response.status);
        testsFailed++;
      }
    } catch (error) {
      console.log('✗ Failed:', error.message);
      testsFailed++;
    }
    console.log('');

    // Test 2: Get Queue Statistics
    console.log('Test 2: Get Queue Statistics');
    console.log('─────────────────────────────────────────────────────');
    try {
      const response = await axios.get(`${BASE_URL}/api/queue/stats`);
      if (response.status === 200 && response.data.stats) {
        console.log('✓ Queue statistics retrieved successfully');
        console.log(`  Pending: ${response.data.stats.pending}`);
        console.log(`  Processing: ${response.data.stats.processing}`);
        console.log(`  Completed: ${response.data.stats.completed}`);
        console.log(`  Failed: ${response.data.stats.failed}`);
        testsPassed++;
      } else {
        console.log('✗ Unexpected response:', response.status);
        testsFailed++;
      }
    } catch (error) {
      console.log('✗ Failed:', error.message);
      testsFailed++;
    }
    console.log('');

    // Test 3: Get Queue Items with Pagination
    console.log('Test 3: Get Queue Items with Pagination');
    console.log('─────────────────────────────────────────────────────');
    try {
      const response = await axios.get(`${BASE_URL}/api/queue/items?limit=10&offset=0`);
      if (response.status === 200 && response.data.items) {
        console.log('✓ Queue items retrieved successfully');
        console.log(`  Items count: ${response.data.count}`);
        console.log(`  Limit: ${response.data.pagination.limit}`);
        console.log(`  Offset: ${response.data.pagination.offset}`);
        testsPassed++;
      } else {
        console.log('✗ Unexpected response:', response.status);
        testsFailed++;
      }
    } catch (error) {
      console.log('✗ Failed:', error.message);
      testsFailed++;
    }
    console.log('');

    // Test 4: Filter Queue Items by Status
    console.log('Test 4: Filter Queue Items by Status');
    console.log('─────────────────────────────────────────────────────');
    try {
      const response = await axios.get(`${BASE_URL}/api/queue/items?status=pending`);
      if (response.status === 200 && response.data.items) {
        console.log('✓ Filtered queue items retrieved successfully');
        console.log(`  Pending items: ${response.data.count}`);
        // Verify all items have pending status
        const allPending = response.data.items.every(item => item.status === 'pending');
        if (allPending || response.data.items.length === 0) {
          console.log('  ✓ All items have pending status');
        } else {
          console.log('  ✗ Some items have incorrect status');
        }
        testsPassed++;
      } else {
        console.log('✗ Unexpected response:', response.status);
        testsFailed++;
      }
    } catch (error) {
      console.log('✗ Failed:', error.message);
      testsFailed++;
    }
    console.log('');

    // Test 5: Get Worker Status
    console.log('Test 5: Get Worker Status');
    console.log('─────────────────────────────────────────────────────');
    try {
      const response = await axios.get(`${BASE_URL}/api/queue/worker/status`);
      if (response.status === 200 && response.data.isRunning !== undefined) {
        console.log('✓ Worker status retrieved successfully');
        console.log(`  Is running: ${response.data.isRunning}`);
        console.log(`  AI Service URL: ${response.data.aiServiceUrl}`);
        testsPassed++;
      } else {
        console.log('✗ Unexpected response:', response.status);
        testsFailed++;
      }
    } catch (error) {
      console.log('✗ Failed:', error.message);
      testsFailed++;
    }
    console.log('');

    // Test 6: Worker Start/Stop Control
    console.log('Test 6: Worker Start/Stop Control');
    console.log('─────────────────────────────────────────────────────');
    try {
      // Get initial status
      const statusResponse = await axios.get(`${BASE_URL}/api/queue/worker/status`);
      const initiallyRunning = statusResponse.data.isRunning;
      
      if (!initiallyRunning) {
        // Start worker
        const startResponse = await axios.post(`${BASE_URL}/api/queue/worker/start`);
        if (startResponse.status === 200 && startResponse.data.success) {
          console.log('  ✓ Worker started successfully');
          
          // Stop worker
          const stopResponse = await axios.post(`${BASE_URL}/api/queue/worker/stop`);
          if (stopResponse.status === 200 && stopResponse.data.success) {
            console.log('  ✓ Worker stopped successfully');
            testsPassed++;
          } else {
            console.log('  ✗ Failed to stop worker');
            testsFailed++;
          }
        } else {
          console.log('  ✗ Failed to start worker');
          testsFailed++;
        }
      } else {
        // Stop and restart
        await axios.post(`${BASE_URL}/api/queue/worker/stop`);
        console.log('  ✓ Worker stopped');
        
        const startResponse = await axios.post(`${BASE_URL}/api/queue/worker/start`);
        if (startResponse.status === 200) {
          console.log('  ✓ Worker started');
          testsPassed++;
        } else {
          console.log('  ✗ Failed to restart worker');
          testsFailed++;
        }
      }
    } catch (error) {
      console.log('✗ Failed:', error.message);
      testsFailed++;
    }
    console.log('');

    // Test 7: Error Handling - Non-existent Queue Item
    console.log('Test 7: Error Handling - Non-existent Queue Item');
    console.log('─────────────────────────────────────────────────────');
    try {
      await axios.get(`${BASE_URL}/api/queue/items/non-existent-id`);
      console.log('✗ Should have returned 404');
      testsFailed++;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log('✓ Correctly returns 404 for non-existent queue item');
        testsPassed++;
      } else {
        console.log('✗ Failed with unexpected error:', error.message);
        testsFailed++;
      }
    }
    console.log('');

    // Test 8: Error Handling - Double Start
    console.log('Test 8: Error Handling - Double Start Worker');
    console.log('─────────────────────────────────────────────────────');
    try {
      // Ensure worker is running
      const statusResponse = await axios.get(`${BASE_URL}/api/queue/worker/status`);
      if (!statusResponse.data.isRunning) {
        await axios.post(`${BASE_URL}/api/queue/worker/start`);
      }
      
      // Try to start again
      await axios.post(`${BASE_URL}/api/queue/worker/start`);
      console.log('✗ Should have returned 400');
      testsFailed++;
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log('✓ Correctly returns 400 when starting already running worker');
        testsPassed++;
      } else {
        console.log('✗ Failed with unexpected error:', error.message);
        testsFailed++;
      }
    }
    console.log('');

    // Cleanup - ensure worker is stopped
    try {
      await axios.post(`${BASE_URL}/api/queue/worker/stop`);
    } catch (e) {
      // Log but do not fail tests on cleanup errors
      console.warn('Warning: failed to stop worker during cleanup:', e && e.message ? e.message : e);
    }

    // Summary
    console.log('╔════════════════════════════════════════════════════╗');
    console.log('║  Test Summary                                      ║');
    console.log('╚════════════════════════════════════════════════════╝');
    console.log(`Tests Passed: ${testsPassed}`);
    console.log(`Tests Failed: ${testsFailed}`);
    console.log('');

    if (testsFailed === 0) {
      console.log('✓ All tests passed!');
      process.exit(0);
    } else {
      console.log('✗ Some tests failed');
      process.exit(1);
    }

  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
}

runTests();
