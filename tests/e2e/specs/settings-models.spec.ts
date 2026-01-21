import { test, expect } from '@playwright/test';

// Use baseURL from playwright.config.ts
const BASE_URL = process.env.BASE_URL || 'https://localhost:21371';

test.describe('Settings and Model Management', () => {
  test('should fetch current settings', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/settings`, {
      ignoreHTTPSErrors: true
    });
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('defaultDepthModel');
    expect(data).toHaveProperty('autoGenerateOnEnter');
    expect(typeof data.autoGenerateOnEnter).toBe('boolean');
    expect(typeof data.defaultDepthModel).toBe('string');
  });

  test('should update settings', async ({ request }) => {
    // Get current settings
    const currentResponse = await request.get(`${BASE_URL}/api/settings`, {
      ignoreHTTPSErrors: true
    });
    const currentSettings = await currentResponse.json();
    
    // Update settings
    const newAutoGenerate = !currentSettings.autoGenerateOnEnter;
    const updateResponse = await request.put(`${BASE_URL}/api/settings`, {
      ignoreHTTPSErrors: true,
      data: {
        autoGenerateOnEnter: newAutoGenerate
      }
    });
    
    expect(updateResponse.status()).toBe(200);
    
    const updatedData = await updateResponse.json();
    expect(updatedData.autoGenerateOnEnter).toBe(newAutoGenerate);
    
    // Restore original settings
    await request.put(`${BASE_URL}/api/settings`, {
      ignoreHTTPSErrors: true,
      data: {
        autoGenerateOnEnter: currentSettings.autoGenerateOnEnter
      }
    });
  });

  test('should reject invalid model in settings', async ({ request }) => {
    const response = await request.put(`${BASE_URL}/api/settings`, {
      ignoreHTTPSErrors: true,
      data: {
        defaultDepthModel: 'invalid-model'
      }
    });
    
    expect(response.status()).toBe(400);
    
    const data = await response.json();
    expect(data.error).toContain('Invalid model');
  });

  test('should fetch AI models list', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/settings/models`, {
      ignoreHTTPSErrors: true
    });
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('models');
    expect(Array.isArray(data.models)).toBe(true);
    
    // Verify model structure
    if (data.models.length > 0) {
      const model = data.models[0];
      expect(model).toHaveProperty('key');
      expect(model).toHaveProperty('name');
      expect(model).toHaveProperty('status');
      expect(model).toHaveProperty('is_loaded');
    }
  });

  test('should fetch AI models from AI service', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/settings/models/ai`, {
      ignoreHTTPSErrors: true
    });
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('models');
    expect(data).toHaveProperty('current_model');
    expect(Array.isArray(data.models)).toBe(true);
  });

  test('should sync models with AI service', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/settings/models/sync`, {
      ignoreHTTPSErrors: true
    });
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.message).toContain('synced');
    expect(data).toHaveProperty('syncedCount');
    expect(typeof data.syncedCount).toBe('number');
  });

  test('should handle model lifecycle - load model', async ({ request }) => {
    // Get available models
    const modelsResponse = await request.get(`${BASE_URL}/api/settings/models`, {
      ignoreHTTPSErrors: true
    });
    const modelsData = await modelsResponse.json();
    
    if (modelsData.models.length === 0) {
      test.skip();
    }
    
    const model = modelsData.models.find((m: any) => m.status === 'downloaded');
    if (!model) {
      test.skip();
    }
    
    // Load the model
    const response = await request.post(
      `https://localhost:21371/api/settings/models/${model.key}/load`,
      { ignoreHTTPSErrors: true }
    );
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.message).toContain('loaded');
  });

  test('should handle model lifecycle - unload model', async ({ request }) => {
    // Get loaded models
    const modelsResponse = await request.get(`${BASE_URL}/api/settings/models`, {
      ignoreHTTPSErrors: true
    });
    const modelsData = await modelsResponse.json();
    
    const loadedModel = modelsData.models.find((m: any) => m.is_loaded);
    if (!loadedModel) {
      test.skip();
    }
    
    // Unload the model
    const response = await request.post(
      `https://localhost:21371/api/settings/models/${loadedModel.key}/unload`,
      { ignoreHTTPSErrors: true }
    );
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.message).toContain('unloaded');
  });

  test('should handle downloading a model', async ({ request }) => {
    // Get not-downloaded models
    const modelsResponse = await request.get(`${BASE_URL}/api/settings/models`, {
      ignoreHTTPSErrors: true
    });
    const modelsData = await modelsResponse.json();
    
    const notDownloadedModel = modelsData.models.find((m: any) => m.status === 'not_downloaded');
    if (!notDownloadedModel) {
      test.skip();
    }
    
    // Try to download (this will likely take a long time, so we just verify the endpoint responds)
    const response = await request.post(
      `${BASE_URL}/api/settings/models/${notDownloadedModel.key}/download`,
      { 
        ignoreHTTPSErrors: true,
        timeout: 5000 // Short timeout to just verify endpoint works
      }
    );
    
    // Should return 200 when successfully started
    expect(response.status()).toBe(200);
  });

  test('should handle deleting a model', async ({ request }) => {
    // This is a destructive operation, so we only test the endpoint structure
    const response = await request.delete(
      `${BASE_URL}/api/settings/models/fake-model`,
      { ignoreHTTPSErrors: true }
    );
    
    // Should return 404 for non-existent model
    expect([400, 404]).toContain(response.status());
  });

  test('should handle invalid model key for load', async ({ request }) => {
    const response = await request.post(
      `${BASE_URL}/api/settings/models/invalid-model/load`,
      { ignoreHTTPSErrors: true }
    );
    
    expect([400, 404]).toContain(response.status());
  });

  test('should handle invalid model key for unload', async ({ request }) => {
    const response = await request.post(
      `${BASE_URL}/api/settings/models/invalid-model/unload`,
      { ignoreHTTPSErrors: true }
    );
    
    expect([400, 404]).toContain(response.status());
  });
});
