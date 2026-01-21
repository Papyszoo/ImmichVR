import { test, expect } from '@playwright/test';

// Use baseURL from playwright.config.ts
const BASE_URL = process.env.BASE_URL || '${BASE_URL}';


test.describe('Queue Management', () => {
  test('should fetch queue summary', async ({ request }) => {
    const response = await request.get('${BASE_URL}/api/queue/summary', {
      ignoreHTTPSErrors: true
    });
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.summary).toBeDefined();
    expect(Array.isArray(data.summary)).toBe(true);
    
    // Summary should have status-based counts
    if (data.summary.length > 0) {
      const item = data.summary[0];
      expect(item).toHaveProperty('status');
      expect(item).toHaveProperty('count');
    }
  });

  test('should fetch queue statistics', async ({ request }) => {
    const response = await request.get('${BASE_URL}/api/queue/stats', {
      ignoreHTTPSErrors: true
    });
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.stats).toBeDefined();
    expect(data.timestamp).toBeDefined();
    
    // Stats should include counts by status
    expect(data.stats).toHaveProperty('pending');
    expect(data.stats).toHaveProperty('processing');
    expect(data.stats).toHaveProperty('completed');
    expect(data.stats).toHaveProperty('failed');
    
    // All should be numbers
    expect(typeof data.stats.pending).toBe('number');
    expect(typeof data.stats.processing).toBe('number');
    expect(typeof data.stats.completed).toBe('number');
    expect(typeof data.stats.failed).toBe('number');
  });

  test('should fetch queue items with pagination', async ({ request }) => {
    const response = await request.get('${BASE_URL}/api/queue/items?limit=10&offset=0', {
      ignoreHTTPSErrors: true
    });
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.items).toBeDefined();
    expect(Array.isArray(data.items)).toBe(true);
    expect(data.count).toBe(data.items.length);
    expect(data.pagination).toBeDefined();
    expect(data.pagination.limit).toBe(10);
    expect(data.pagination.offset).toBe(0);
    
    // Verify item structure if items exist
    if (data.items.length > 0) {
      const item = data.items[0];
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('status');
      expect(item).toHaveProperty('priority');
    }
  });

  test('should filter queue items by status', async ({ request }) => {
    const response = await request.get('${BASE_URL}/api/queue/items?status=pending', {
      ignoreHTTPSErrors: true
    });
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(Array.isArray(data.items)).toBe(true);
    
    // All items should have pending status
    data.items.forEach((item: any) => {
      expect(item.status).toBe('pending');
    });
  });

  test('should get worker status', async ({ request }) => {
    const response = await request.get('${BASE_URL}/api/queue/worker/status', {
      ignoreHTTPSErrors: true
    });
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('isRunning');
    expect(data).toHaveProperty('aiServiceUrl');
    expect(typeof data.isRunning).toBe('boolean');
  });

  test('should start and stop worker', async ({ request }) => {
    // Get initial status
    const statusResponse = await request.get('${BASE_URL}/api/queue/worker/status', {
      ignoreHTTPSErrors: true
    });
    const initialStatus = await statusResponse.json();
    
    if (!initialStatus.isRunning) {
      // Start worker
      const startResponse = await request.post('${BASE_URL}/api/queue/worker/start', {
        ignoreHTTPSErrors: true
      });
      
      expect(startResponse.status()).toBe(200);
      
      const startData = await startResponse.json();
      expect(startData.success).toBe(true);
      expect(startData.message).toContain('started');
      
      // Verify it's running
      const runningStatus = await request.get('${BASE_URL}/api/queue/worker/status', {
        ignoreHTTPSErrors: true
      });
      const runningData = await runningStatus.json();
      expect(runningData.isRunning).toBe(true);
      
      // Stop worker
      const stopResponse = await request.post('${BASE_URL}/api/queue/worker/stop', {
        ignoreHTTPSErrors: true
      });
      
      expect(stopResponse.status()).toBe(200);
      
      const stopData = await stopResponse.json();
      expect(stopData.success).toBe(true);
      expect(stopData.message).toContain('stopped');
    } else {
      // If already running, just stop and restart
      await request.post('${BASE_URL}/api/queue/worker/stop', {
        ignoreHTTPSErrors: true
      });
      
      const startResponse = await request.post('${BASE_URL}/api/queue/worker/start', {
        ignoreHTTPSErrors: true
      });
      expect(startResponse.status()).toBe(200);
      
      // Stop again
      await request.post('${BASE_URL}/api/queue/worker/stop', {
        ignoreHTTPSErrors: true
      });
    }
  });

  test('should handle starting already running worker', async ({ request }) => {
    // Ensure worker is running
    const statusResponse = await request.get('${BASE_URL}/api/queue/worker/status', {
      ignoreHTTPSErrors: true
    });
    const status = await statusResponse.json();
    
    if (!status.isRunning) {
      await request.post('${BASE_URL}/api/queue/worker/start', {
        ignoreHTTPSErrors: true
      });
    }
    
    // Try to start again
    const response = await request.post('${BASE_URL}/api/queue/worker/start', {
      ignoreHTTPSErrors: true
    });
    
    expect(response.status()).toBe(400);
    
    const data = await response.json();
    expect(data.error).toBe('Worker already running');
    
    // Clean up - stop worker
    await request.post('${BASE_URL}/api/queue/worker/stop', {
      ignoreHTTPSErrors: true
    });
  });

  test('should handle stopping already stopped worker', async ({ request }) => {
    // Ensure worker is stopped
    const statusResponse = await request.get('${BASE_URL}/api/queue/worker/status', {
      ignoreHTTPSErrors: true
    });
    const status = await statusResponse.json();
    
    if (status.isRunning) {
      await request.post('${BASE_URL}/api/queue/worker/stop', {
        ignoreHTTPSErrors: true
      });
    }
    
    // Try to stop again
    const response = await request.post('${BASE_URL}/api/queue/worker/stop', {
      ignoreHTTPSErrors: true
    });
    
    expect(response.status()).toBe(400);
    
    const data = await response.json();
    expect(data.error).toBe('Worker not running');
  });

  test('should handle 404 for non-existent queue item', async ({ request }) => {
    const response = await request.get('${BASE_URL}/api/queue/items/non-existent-id', {
      ignoreHTTPSErrors: true
    });
    
    expect(response.status()).toBe(404);
    
    const data = await response.json();
    expect(data.error).toBe('Queue item not found');
  });

  test('should handle cancel queue item', async ({ request }) => {
    // This test depends on having a queue item
    // For now, we test the error case
    const response = await request.post('${BASE_URL}/api/queue/items/fake-id/cancel', {
      ignoreHTTPSErrors: true
    });
    
    // Should fail with 400 for non-existent item
    expect([400, 404]).toContain(response.status());
  });

  test('should handle retry queue item', async ({ request }) => {
    // This test depends on having a failed queue item
    // For now, we test the error case
    const response = await request.post('${BASE_URL}/api/queue/items/fake-id/retry', {
      ignoreHTTPSErrors: true
    });
    
    // Should fail with 400 for non-existent item
    expect([400, 404]).toContain(response.status());
  });
});
