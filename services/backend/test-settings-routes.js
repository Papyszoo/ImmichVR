#!/usr/bin/env node
/**
 * Integration Test Script for Settings and Model Management Routes
 * Tests settings updates and model lifecycle operations
 * 
 * Note: This test requires PostgreSQL and AI service to be running
 */

const axios = require('axios');

const BASE_URL = process.env.BACKEND_URL || 'http://localhost:3000';

console.log('╔════════════════════════════════════════════════════╗');
console.log('║  Settings & Model Management Integration Test     ║');
console.log('╚════════════════════════════════════════════════════╝\n');

async function runTests() {
  let testsPassed = 0;
  let testsFailed = 0;
  let originalSettings = null;

  try {
    // Test 1: Get Current Settings
    console.log('Test 1: Get Current Settings');
    console.log('─────────────────────────────────────────────────────');
    try {
      const response = await axios.get(`${BASE_URL}/api/settings`);
      if (response.status === 200) {
        originalSettings = response.data;
        console.log('✓ Settings retrieved successfully');
        console.log(`  Default depth model: ${response.data.defaultDepthModel}`);
        console.log(`  Auto generate on enter: ${response.data.autoGenerateOnEnter}`);
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

    // Test 2: Update Settings
    console.log('Test 2: Update Settings');
    console.log('─────────────────────────────────────────────────────');
    try {
      const newAutoGenerate = !originalSettings.autoGenerateOnEnter;
      const response = await axios.put(`${BASE_URL}/api/settings`, {
        autoGenerateOnEnter: newAutoGenerate
      });
      
      if (response.status === 200 && response.data.autoGenerateOnEnter === newAutoGenerate) {
        console.log('✓ Settings updated successfully');
        console.log(`  New auto generate value: ${response.data.autoGenerateOnEnter}`);
        testsPassed++;
        
        // Restore original setting
        await axios.put(`${BASE_URL}/api/settings`, {
          autoGenerateOnEnter: originalSettings.autoGenerateOnEnter
        });
      } else {
        console.log('✗ Unexpected response:', response.status);
        testsFailed++;
      }
    } catch (error) {
      console.log('✗ Failed:', error.message);
      testsFailed++;
    }
    console.log('');

    // Test 3: Invalid Model Rejection
    console.log('Test 3: Invalid Model Rejection');
    console.log('─────────────────────────────────────────────────────');
    try {
      await axios.put(`${BASE_URL}/api/settings`, {
        defaultDepthModel: 'invalid-model'
      });
      console.log('✗ Should have returned 400');
      testsFailed++;
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log('✓ Correctly rejects invalid model');
        console.log(`  Error: ${error.response.data.error}`);
        testsPassed++;
      } else {
        console.log('✗ Failed with unexpected error:', error.message);
        testsFailed++;
      }
    }
    console.log('');

    // Test 4: Get AI Models List
    console.log('Test 4: Get AI Models List');
    console.log('─────────────────────────────────────────────────────');
    try {
      const response = await axios.get(`${BASE_URL}/api/settings/models`);
      if (response.status === 200 && response.data.models) {
        console.log('✓ Models list retrieved successfully');
        console.log(`  Models count: ${response.data.models.length}`);
        response.data.models.forEach(model => {
          console.log(`  - ${model.key}: ${model.name} (${model.status})`);
        });
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

    // Test 5: Get AI Models from AI Service
    console.log('Test 5: Get AI Models from AI Service');
    console.log('─────────────────────────────────────────────────────');
    try {
      const response = await axios.get(`${BASE_URL}/api/settings/models/ai`);
      if (response.status === 200 && response.data.models) {
        console.log('✓ AI service models retrieved successfully');
        console.log(`  Models count: ${response.data.models.length}`);
        console.log(`  Current model: ${response.data.current_model || 'None'}`);
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

    // Test 6: Sync Models with AI Service
    console.log('Test 6: Sync Models with AI Service');
    console.log('─────────────────────────────────────────────────────');
    try {
      const response = await axios.post(`${BASE_URL}/api/settings/models/sync`);
      if (response.status === 200 && response.data.syncedCount !== undefined) {
        console.log('✓ Models synced successfully');
        console.log(`  Synced count: ${response.data.syncedCount}`);
        console.log(`  Message: ${response.data.message}`);
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

    // Test 7: Model Lifecycle - Load Model
    console.log('Test 7: Model Lifecycle - Load Model');
    console.log('─────────────────────────────────────────────────────');
    try {
      const modelsResponse = await axios.get(`${BASE_URL}/api/settings/models`);
      const downloadedModel = modelsResponse.data.models.find(m => m.status === 'downloaded');
      
      if (downloadedModel) {
        const response = await axios.post(`${BASE_URL}/api/settings/models/${downloadedModel.key}/load`);
        if (response.status === 200 && response.data.success) {
          console.log('✓ Model loaded successfully');
          console.log(`  Model: ${downloadedModel.key}`);
          testsPassed++;
        } else {
          console.log('✗ Unexpected response:', response.status);
          testsFailed++;
        }
      } else {
        console.log('⊘ No downloaded models available for testing (skipped)');
        testsPassed++; // Count as passed since this is expected in some environments
      }
    } catch (error) {
      console.log('✗ Failed:', error.message);
      testsFailed++;
    }
    console.log('');

    // Test 8: Model Lifecycle - Unload Model
    console.log('Test 8: Model Lifecycle - Unload Model');
    console.log('─────────────────────────────────────────────────────');
    try {
      const modelsResponse = await axios.get(`${BASE_URL}/api/settings/models`);
      const loadedModel = modelsResponse.data.models.find(m => m.is_loaded);
      
      if (loadedModel) {
        const response = await axios.post(`${BASE_URL}/api/settings/models/${loadedModel.key}/unload`);
        if (response.status === 200 && response.data.success) {
          console.log('✓ Model unloaded successfully');
          console.log(`  Model: ${loadedModel.key}`);
          testsPassed++;
        } else {
          console.log('✗ Unexpected response:', response.status);
          testsFailed++;
        }
      } else {
        console.log('⊘ No loaded models available for testing (skipped)');
        testsPassed++; // Count as passed since this is expected in some environments
      }
    } catch (error) {
      console.log('✗ Failed:', error.message);
      testsFailed++;
    }
    console.log('');

    // Test 9: Error Handling - Invalid Model Key
    console.log('Test 9: Error Handling - Invalid Model Key');
    console.log('─────────────────────────────────────────────────────');
    try {
      await axios.post(`${BASE_URL}/api/settings/models/invalid-model/load`);
      console.log('✗ Should have returned 400 or 404');
      testsFailed++;
    } catch (error) {
      if (error.response && [400, 404].includes(error.response.status)) {
        console.log('✓ Correctly handles invalid model key');
        console.log(`  Status: ${error.response.status}`);
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
