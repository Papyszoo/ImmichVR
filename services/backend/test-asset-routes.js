#!/usr/bin/env node
/**
 * Integration Test Script for Asset Operations Routes
 * Tests asset generation, download, deletion, and conversion
 * 
 * Note: This test requires PostgreSQL and AI service to be running
 */

const axios = require('axios');

const BASE_URL = process.env.BACKEND_URL || 'http://localhost:3000';

console.log('╔════════════════════════════════════════════════════╗');
console.log('║  Asset Operations Integration Test                ║');
console.log('╚════════════════════════════════════════════════════╝\n');

async function runTests() {
  let testsPassed = 0;
  let testsFailed = 0;
  let testAssetId = null;
  let testFileId = null;

  try {
    // Get a test photo to work with
    console.log('Setup: Getting test photo...');
    const photosResponse = await axios.get(`${BASE_URL}/api/immich/photos?size=1`);
    if (photosResponse.data.data.length > 0) {
      testAssetId = photosResponse.data.data[0].id;
      console.log(`Using test asset: ${testAssetId}\n`);
    } else {
      console.log('⊘ No photos available for testing\n');
      return;
    }

    // Test 1: List Generated Files
    console.log('Test 1: List Generated Files');
    console.log('─────────────────────────────────────────────────────');
    try {
      const response = await axios.get(`${BASE_URL}/api/assets/${testAssetId}/files`);
      if (response.status === 200) {
        console.log('✓ Files list retrieved successfully');
        console.log(`  Files count: ${response.data.count}`);
        if (response.data.files.length > 0) {
          testFileId = response.data.files[0].id;
          console.log(`  First file ID: ${testFileId}`);
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

    // Test 2: Generate Depth Map
    console.log('Test 2: Generate Depth Map');
    console.log('─────────────────────────────────────────────────────');
    try {
      const response = await axios.post(`${BASE_URL}/api/assets/${testAssetId}/generate`, {
        type: 'depth',
        modelKey: 'small'
      }, {
        responseType: 'arraybuffer',
        timeout: 30000
      });
      
      if (response.status === 200 && response.headers['content-type'].includes('image/png')) {
        console.log('✓ Depth map generated successfully');
        console.log(`  Size: ${response.data.length} bytes`);
        console.log(`  Cache: ${response.headers['x-asset-cache'] || 'unknown'}`);
        testsPassed++;
        
        // Update files list
        const filesResponse = await axios.get(`${BASE_URL}/api/assets/${testAssetId}/files`);
        if (filesResponse.data.files.length > 0) {
          testFileId = filesResponse.data.files[0].id;
        }
      } else {
        console.log('✗ Unexpected response:', response.status);
        testsFailed++;
      }
    } catch (error) {
      console.log('✗ Failed:', error.message);
      testsFailed++;
    }
    console.log('');

    // Test 3: Download Generated File
    if (testFileId) {
      console.log('Test 3: Download Generated File');
      console.log('─────────────────────────────────────────────────────');
      try {
        const response = await axios.get(`${BASE_URL}/api/assets/${testAssetId}/files/${testFileId}/download`, {
          responseType: 'arraybuffer'
        });
        
        if (response.status === 200) {
          console.log('✓ File downloaded successfully');
          console.log(`  Size: ${response.data.length} bytes`);
          console.log(`  Content-Type: ${response.headers['content-type']}`);
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
    } else {
      console.log('Test 3: Download Generated File');
      console.log('─────────────────────────────────────────────────────');
      console.log('⊘ Skipped - no file ID available\n');
    }

    // Test 4: Asset Conversion (PLY to KSPLAT)
    console.log('Test 4: Asset Conversion (PLY to KSPLAT)');
    console.log('─────────────────────────────────────────────────────');
    try {
      const response = await axios.post(`${BASE_URL}/api/assets/${testAssetId}/convert`, {
        from: 'ply',
        to: 'ksplat'
      });
      
      // Accept 200, 400, or 404 (depending on whether PLY exists)
      if ([200, 400, 404].includes(response.status)) {
        console.log('✓ Conversion endpoint responded correctly');
        console.log(`  Status: ${response.status}`);
        if (response.data.message) {
          console.log(`  Message: ${response.data.message}`);
        }
        testsPassed++;
      } else {
        console.log('✗ Unexpected response:', response.status);
        testsFailed++;
      }
    } catch (error) {
      if (error.response && [400, 404].includes(error.response.status)) {
        console.log('✓ Conversion endpoint responded correctly');
        console.log(`  Status: ${error.response.status}`);
        console.log(`  Message: ${error.response.data.error}`);
        testsPassed++;
      } else {
        console.log('✗ Failed:', error.message);
        testsFailed++;
      }
    }
    console.log('');

    // Test 5: Delete Generated File
    if (testFileId) {
      console.log('Test 5: Delete Generated File');
      console.log('─────────────────────────────────────────────────────');
      try {
        const response = await axios.delete(`${BASE_URL}/api/assets/${testAssetId}/files/${testFileId}`);
        
        if (response.status === 200 && response.data.success) {
          console.log('✓ File deleted successfully');
          console.log(`  Deleted file ID: ${response.data.deletedFileId}`);
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
    } else {
      console.log('Test 5: Delete Generated File');
      console.log('─────────────────────────────────────────────────────');
      console.log('⊘ Skipped - no file ID available\n');
    }

    // Test 6: Error Handling - Non-existent File
    console.log('Test 6: Error Handling - Non-existent File');
    console.log('─────────────────────────────────────────────────────');
    try {
      await axios.get(`${BASE_URL}/api/assets/fake-id/files/fake-file-id/download`);
      console.log('✗ Should have returned 404');
      testsFailed++;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log('✓ Correctly returns 404 for non-existent file');
        testsPassed++;
      } else {
        console.log('✗ Failed with unexpected error:', error.message);
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
