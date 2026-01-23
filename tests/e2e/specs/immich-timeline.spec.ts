import { test, expect } from '@playwright/test';

// Use baseURL from playwright.config.ts
const BASE_URL = process.env.BASE_URL || 'https://127.0.0.1:21371';


test.describe('Immich Timeline API', () => {
  test('should fetch timeline buckets', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/immich/timeline`, {
      ignoreHTTPSErrors: true
    });
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.status).toBe('success');
    expect(data.data).toBeDefined();
    expect(Array.isArray(data.data)).toBe(true);
    
    // Timeline buckets should have expected structure
    if (data.data.length > 0) {
      const bucket = data.data[0];
      expect(bucket).toHaveProperty('timeBucket');
      expect(bucket).toHaveProperty('count');
    }
  });

  test('should fetch assets for a specific timeline bucket', async ({ request }) => {
    // First get timeline buckets
    const bucketsResponse = await request.get(`${BASE_URL}/api/immich/timeline`, {
      ignoreHTTPSErrors: true
    });
    const bucketsData = await bucketsResponse.json();
    
    expect(bucketsData.data.length).toBeGreaterThan(0);
    const firstBucket = bucketsData.data[0].timeBucket;
    
    // Fetch assets for that bucket
    const response = await request.get(
      `${BASE_URL}/api/immich/timeline/${encodeURIComponent(firstBucket)}`,
      { ignoreHTTPSErrors: true }
    );
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.status).toBe('success');
    expect(data.count).toBeGreaterThan(0);
    expect(Array.isArray(data.data)).toBe(true);
    
    // Assets should have proper structure
    const asset = data.data[0];
    expect(asset).toHaveProperty('id');
    expect(asset).toHaveProperty('type');
  });

  test('should fetch asset statistics', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/immich/statistics`, {
      ignoreHTTPSErrors: true
    });
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.status).toBe('success');
    expect(data.data).toBeDefined();
    expect(data.data).toHaveProperty('images');
    expect(data.data).toHaveProperty('videos');
    expect(typeof data.data.images).toBe('number');
    expect(typeof data.data.videos).toBe('number');
  });

  test('should fetch videos from Immich API', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/immich/videos?size=10`, {
      ignoreHTTPSErrors: true
    });
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.status).toBe('success');
    expect(Array.isArray(data.data)).toBe(true);
    
    // Verify video structure if any videos exist
    if (data.data.length > 0) {
      const video = data.data[0];
      expect(video).toHaveProperty('id');
      expect(video).toHaveProperty('type');
      expect(video.type).toBe('VIDEO');
    }
  });

  test('should fetch processed photos with 3D assets', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/immich/processed?size=10`, {
      ignoreHTTPSErrors: true
    });
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.status).toBe('success');
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.page).toBeDefined();
    expect(data.size).toBeDefined();
    
    // Verify structure if processed photos exist
    if (data.data.length > 0) {
      const photo = data.data[0];
      expect(photo).toHaveProperty('id');
      expect(photo).toHaveProperty('originalFileName');
    }
  });

  test('should handle search endpoint (not implemented)', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/immich/search`, {
      ignoreHTTPSErrors: true,
      data: {
        query: 'test',
        type: 'IMAGE',
        size: 10
      }
    });
    
    // Search is not implemented yet, should return 501
    expect(response.status()).toBe(501);
    
    const data = await response.json();
    expect(data.error).toBe('Not implemented');
  });
});
