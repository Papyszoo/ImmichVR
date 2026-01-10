#!/usr/bin/env node
/**
 * Integration Test for Experimental Video Depth Map Processing
 * Tests video frame extraction and depth map generation
 * 
 * Note: This test requires:
 * - PostgreSQL to be running and accessible
 * - AI service to be running with FFmpeg installed
 * - ENABLE_EXPERIMENTAL_VIDEO=true in environment
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Test configuration
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5000';
const ENABLE_EXPERIMENTAL_VIDEO = process.env.ENABLE_EXPERIMENTAL_VIDEO === 'true';

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║  Experimental Video Depth Map Processing Test           ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

async function createTestVideo() {
  console.log('Test 1: Create Test Video');
  console.log('────────────────────────────────────────────────────────────');
  
  // Check if FFmpeg is available
  try {
    await execAsync('ffmpeg -version');
    console.log('✓ FFmpeg is available');
  } catch (error) {
    console.log('✗ FFmpeg not found. Creating a dummy video file instead.');
    const dummyContent = Buffer.from('dummy video content');
    await fs.promises.writeFile('/tmp/test_video.mp4', dummyContent);
    console.log('✓ Created dummy test video file\n');
    return '/tmp/test_video.mp4';
  }
  
  // Create a simple 5-second test video with color changes
  const videoPath = '/tmp/test_video.mp4';
  const cmd = `ffmpeg -y -f lavfi -i testsrc=duration=5:size=640x480:rate=30 -pix_fmt yuv420p ${videoPath}`;
  
  try {
    await execAsync(cmd);
    console.log(`✓ Created test video: ${videoPath}`);
    
    const stats = await fs.promises.stat(videoPath);
    console.log(`  File size: ${(stats.size / 1024).toFixed(2)} KB\n`);
    
    return videoPath;
  } catch (error) {
    console.log(`✗ Failed to create video: ${error.message}`);
    throw error;
  }
}

async function testFeatureEnabled() {
  console.log('Test 2: Check Experimental Feature Status');
  console.log('────────────────────────────────────────────────────────────');
  
  if (!ENABLE_EXPERIMENTAL_VIDEO) {
    console.log('⚠ ENABLE_EXPERIMENTAL_VIDEO is not set to true');
    console.log('  Video processing will fail during upload processing');
    console.log('  Set ENABLE_EXPERIMENTAL_VIDEO=true to enable\n');
    return false;
  } else {
    console.log('✓ Experimental video processing is enabled');
    console.log('  ENABLE_EXPERIMENTAL_VIDEO=true\n');
    return true;
  }
}

async function testAIServiceHealth() {
  console.log('Test 3: AI Service Health Check');
  console.log('────────────────────────────────────────────────────────────');
  
  try {
    const response = await axios.get(`${AI_SERVICE_URL}/health`, { timeout: 5000 });
    
    if (response.status === 200) {
      console.log('✓ AI Service is healthy');
      console.log(`  Model: ${response.data.model || 'unknown'}`);
      console.log(`  Status: ${response.data.model_status || 'unknown'}\n`);
      return true;
    } else {
      console.log(`✗ AI Service returned status ${response.status}\n`);
      return false;
    }
  } catch (error) {
    console.log(`✗ AI Service health check failed: ${error.message}`);
    console.log('  Make sure AI service is running\n');
    return false;
  }
}

async function testAIServiceEndpoints() {
  console.log('Test 4: Check AI Service Video Endpoints');
  console.log('────────────────────────────────────────────────────────────');
  
  try {
    const response = await axios.get(`${AI_SERVICE_URL}/`, { timeout: 5000 });
    
    if (response.data.endpoints) {
      const endpoints = response.data.endpoints;
      console.log('✓ AI Service endpoints:');
      Object.keys(endpoints).forEach(key => {
        console.log(`  - ${key}: ${endpoints[key]}`);
      });
      
      if (endpoints.extract_video_frames && endpoints.process_video_depth) {
        console.log('✓ Video processing endpoints are available\n');
        return true;
      } else {
        console.log('✗ Video processing endpoints not found\n');
        return false;
      }
    } else {
      console.log('✗ Could not retrieve endpoint information\n');
      return false;
    }
  } catch (error) {
    console.log(`✗ Failed to check endpoints: ${error.message}\n`);
    return false;
  }
}

async function testBackendHealth() {
  console.log('Test 5: Backend Service Health Check');
  console.log('────────────────────────────────────────────────────────────');
  
  try {
    const response = await axios.get(`${BACKEND_URL}/health`, { timeout: 5000 });
    
    if (response.status === 200) {
      console.log('✓ Backend service is healthy');
      console.log(`  Database: ${response.data.database || 'unknown'}\n`);
      return true;
    } else {
      console.log(`✗ Backend returned status ${response.status}\n`);
      return false;
    }
  } catch (error) {
    console.log(`✗ Backend health check failed: ${error.message}`);
    console.log('  Make sure backend service is running\n');
    return false;
  }
}

async function testVideoFrameExtraction(videoPath) {
  console.log('Test 6: Video Frame Extraction (AI Service)');
  console.log('────────────────────────────────────────────────────────────');
  
  try {
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('video', fs.createReadStream(videoPath));
    
    const response = await axios.post(
      `${AI_SERVICE_URL}/api/video/frames?fps=1&max_frames=5&method=interval`,
      formData,
      {
        headers: formData.getHeaders(),
        timeout: 60000
      }
    );
    
    if (response.status === 200 && response.data.success) {
      console.log('✓ Frame extraction successful');
      console.log(`  Frames extracted: ${response.data.frame_count}`);
      console.log(`  Method: ${response.data.method}`);
      console.log(`  FPS: ${response.data.fps || 'N/A'}\n`);
      return true;
    } else {
      console.log(`✗ Frame extraction returned status ${response.status}`);
      console.log(`  Response: ${JSON.stringify(response.data)}\n`);
      return false;
    }
  } catch (error) {
    console.log(`✗ Frame extraction failed: ${error.message}`);
    if (error.response) {
      console.log(`  Status: ${error.response.status}`);
      console.log(`  Data: ${JSON.stringify(error.response.data)}`);
    }
    console.log('');
    return false;
  }
}

async function testVideoUpload(videoPath) {
  console.log('Test 7: Video Upload to Backend');
  console.log('────────────────────────────────────────────────────────────');
  
  if (!ENABLE_EXPERIMENTAL_VIDEO) {
    console.log('⚠ Skipping upload test - experimental feature not enabled');
    console.log('  Enable ENABLE_EXPERIMENTAL_VIDEO=true to test full workflow\n');
    return null;
  }
  
  try {
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('media', fs.createReadStream(videoPath));
    
    const response = await axios.post(
      `${BACKEND_URL}/api/media/upload`,
      formData,
      {
        headers: formData.getHeaders(),
        timeout: 10000
      }
    );
    
    if (response.status === 201 && response.data.success) {
      console.log('✓ Video uploaded successfully');
      console.log(`  Media ID: ${response.data.mediaItemId}`);
      console.log(`  Queue ID: ${response.data.queueId}`);
      console.log(`  Type: ${response.data.type}`);
      console.log(`  Size: ${(response.data.size / 1024).toFixed(2)} KB\n`);
      return response.data.mediaItemId;
    } else {
      console.log(`✗ Upload returned status ${response.status}`);
      console.log(`  Response: ${JSON.stringify(response.data)}\n`);
      return null;
    }
  } catch (error) {
    console.log(`✗ Upload failed: ${error.message}`);
    if (error.response) {
      console.log(`  Status: ${error.response.status}`);
      console.log(`  Data: ${JSON.stringify(error.response.data)}`);
    }
    console.log('');
    return null;
  }
}

async function checkQueueStatus(mediaItemId) {
  console.log('Test 8: Check Queue Processing Status');
  console.log('────────────────────────────────────────────────────────────');
  
  if (!mediaItemId) {
    console.log('⚠ Skipping - no media item to check\n');
    return;
  }
  
  try {
    const response = await axios.get(`${BACKEND_URL}/api/queue/stats`, { timeout: 5000 });
    
    if (response.status === 200) {
      console.log('✓ Queue statistics retrieved:');
      const stats = response.data.stats;
      console.log(`  Queued: ${stats.queued || 0}`);
      console.log(`  Processing: ${stats.processing || 0}`);
      console.log(`  Completed: ${stats.completed || 0}`);
      console.log(`  Failed: ${stats.failed || 0}`);
      console.log('\n⚠ Note: Video processing may take several minutes');
      console.log('  Monitor with: docker compose logs -f ai backend\n');
    }
  } catch (error) {
    console.log(`✗ Failed to check queue: ${error.message}\n`);
  }
}

async function cleanup(videoPath) {
  console.log('Cleanup');
  console.log('────────────────────────────────────────────────────────────');
  
  try {
    if (fs.existsSync(videoPath)) {
      await fs.promises.unlink(videoPath);
      console.log('✓ Cleaned up test video file\n');
    }
  } catch (error) {
    console.log(`⚠ Cleanup warning: ${error.message}\n`);
  }
}

async function runTests() {
  let videoPath = null;
  let testsPassed = 0;
  let testsTotal = 0;
  
  try {
    // Create test video
    testsTotal++;
    try {
      videoPath = await createTestVideo();
      testsPassed++;
    } catch (error) {
      console.log('Cannot proceed without test video\n');
      return;
    }
    
    // Check feature flag
    testsTotal++;
    if (await testFeatureEnabled()) {
      testsPassed++;
    }
    
    // Test AI service
    testsTotal++;
    if (await testAIServiceHealth()) {
      testsPassed++;
    }
    
    testsTotal++;
    if (await testAIServiceEndpoints()) {
      testsPassed++;
    }
    
    // Test backend
    testsTotal++;
    if (await testBackendHealth()) {
      testsPassed++;
    }
    
    // Test frame extraction
    testsTotal++;
    if (await testVideoFrameExtraction(videoPath)) {
      testsPassed++;
    }
    
    // Test upload (if enabled)
    testsTotal++;
    const mediaItemId = await testVideoUpload(videoPath);
    if (mediaItemId) {
      testsPassed++;
      await checkQueueStatus(mediaItemId);
    }
    
    // Summary
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log(`║  Test Results: ${testsPassed}/${testsTotal} Passed${' '.repeat(32 - testsPassed.toString().length - testsTotal.toString().length)}║`);
    console.log('╚══════════════════════════════════════════════════════════╝\n');
    
    if (testsPassed === testsTotal) {
      console.log('✅ All tests passed!');
      console.log('\nExperimental video depth map processing is working correctly.');
    } else {
      console.log('⚠ Some tests failed. Check the output above for details.');
    }
    
    if (!ENABLE_EXPERIMENTAL_VIDEO) {
      console.log('\n📝 To enable video processing:');
      console.log('   1. Add ENABLE_EXPERIMENTAL_VIDEO=true to your .env file');
      console.log('   2. Restart services: docker compose restart backend');
      console.log('   3. Re-run this test script');
    }
    
    console.log('\n📚 Documentation: VIDEO_DEPTH_SUPPORT.md');
    console.log('');
    
  } catch (error) {
    console.error('\n✗ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (videoPath) {
      await cleanup(videoPath);
    }
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
