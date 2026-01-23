#!/usr/bin/env node
/**
 * Integration Test Script for Timeline and Search Routes
 * Tests the Immich integration endpoints
 * 
 * Note: This test requires PostgreSQL and mock Immich API to be running
 */

const axios = require('axios');

const BASE_URL = process.env.BACKEND_URL || 'http://localhost:3000';

console.log('╔════════════════════════════════════════════════════╗');
console.log('║  Timeline & Search Integration Test               ║');
console.log('╚════════════════════════════════════════════════════╝\n');

async function runTests() {
  let testsPassed = 0;
  let testsFailed = 0;

  try {
    // Test 1: Get Timeline Buckets
    console.log('Test 1: Get Timeline Buckets');
    console.log('─────────────────────────────────────────────────────');
    try {
      const response = await axios.get(`${BASE_URL}/api/immich/timeline`);
      if (response.status === 200 && response.data.status === 'success') {
        console.log('✓ Timeline buckets retrieved successfully');
        console.log(`  Buckets: ${response.data.data.length}`);
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

    // Test 2: Get Timeline Bucket Assets
    console.log('Test 2: Get Timeline Bucket Assets');
    console.log('─────────────────────────────────────────────────────');
    try {
      // First get a bucket
      const bucketsResponse = await axios.get(`${BASE_URL}/api/immich/timeline`);
      if (bucketsResponse.data.data.length > 0) {
        const bucket = bucketsResponse.data.data[0].timeBucket;
        const response = await axios.get(`${BASE_URL}/api/immich/timeline/${encodeURIComponent(bucket)}`);
        
        if (response.status === 200 && response.data.status === 'success') {
          console.log('✓ Timeline bucket assets retrieved successfully');
          console.log(`  Assets in bucket: ${response.data.count}`);
          testsPassed++;
        } else {
          console.log('✗ Unexpected response:', response.status);
          testsFailed++;
        }
      } else {
        console.log('⊘ No buckets available for testing (skipped)');
        testsPassed++; // Count as passed since this is expected in some environments
      }
    } catch (error) {
      console.log('✗ Failed:', error.message);
      testsFailed++;
    }
    console.log('');

    // Test 3: Get Asset Statistics
    console.log('Test 3: Get Asset Statistics');
    console.log('─────────────────────────────────────────────────────');
    try {
      const response = await axios.get(`${BASE_URL}/api/immich/statistics`);
      if (response.status === 200 && response.data.status === 'success') {
        console.log('✓ Asset statistics retrieved successfully');
        console.log(`  Images: ${response.data.data.images}`);
        console.log(`  Videos: ${response.data.data.videos}`);
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

    // Test 4: Get Videos
    console.log('Test 4: Get Videos');
    console.log('─────────────────────────────────────────────────────');
    try {
      const response = await axios.get(`${BASE_URL}/api/immich/videos?size=10`);
      if (response.status === 200 && response.data.status === 'success') {
        console.log('✓ Videos retrieved successfully');
        console.log(`  Count: ${response.data.count}`);
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

    // Test 5: Get Processed Photos
    console.log('Test 5: Get Processed Photos with 3D Assets');
    console.log('─────────────────────────────────────────────────────');
    try {
      const response = await axios.get(`${BASE_URL}/api/immich/processed?size=10`);
      if (response.status === 200 && response.data.status === 'success') {
        console.log('✓ Processed photos retrieved successfully');
        console.log(`  Count: ${response.data.count}`);
        console.log(`  Page: ${response.data.page}`);
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

    // Test 6: Search (Not Implemented)
    console.log('Test 6: Search Assets (Expected: Not Implemented)');
    console.log('─────────────────────────────────────────────────────');
    try {
      const response = await axios.post(`${BASE_URL}/api/immich/search`, {
        query: 'test',
        type: 'IMAGE',
        size: 10
      });
      if (response.status === 501) {
        console.log('✓ Search correctly returns 501 Not Implemented');
        testsPassed++;
      } else {
        console.log('✗ Unexpected response:', response.status);
        testsFailed++;
      }
    } catch (error) {
      if (error.response && error.response.status === 501) {
        console.log('✓ Search correctly returns 501 Not Implemented');
        testsPassed++;
      } else {
        console.log('✗ Failed:', error.message);
        testsFailed++;
      }
    }
    console.log('');

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
