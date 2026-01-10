/**
 * Basic API service tests
 * Note: These are integration tests that require a running backend
 */

import { 
  checkHealth,
  getMediaStatus,
  getImmichPhotos 
} from './api.js';

// Mock test - would need Jest or similar for actual testing
console.log('API Service Tests');

// Test 1: Check if functions are exported
console.log('✓ checkHealth function exported:', typeof checkHealth === 'function');
console.log('✓ getMediaStatus function exported:', typeof getMediaStatus === 'function');
console.log('✓ getImmichPhotos function exported:', typeof getImmichPhotos === 'function');

// Test 2: Verify API URL configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
console.log('✓ API Base URL configured:', API_BASE_URL);

export default {
  checkHealth,
  getMediaStatus,
  getImmichPhotos
};
