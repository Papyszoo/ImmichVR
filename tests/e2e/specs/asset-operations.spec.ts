import { test, expect } from '@playwright/test';

// Use baseURL from playwright.config.ts
const BASE_URL = process.env.BASE_URL || '${BASE_URL}';


test.describe('Asset Operations', () => {
  let testAssetId: string;
  let testFileId: string;

  test.beforeAll(async ({ request }) => {
    // Get a test photo to work with
    const photosResponse = await request.get('${BASE_URL}/api/immich/photos?size=1', {
      ignoreHTTPSErrors: true
    });
    const photosData = await photosResponse.json();
    
    if (photosData.data && photosData.data.length > 0) {
      testAssetId = photosData.data[0].id;
    }
  });

  test('should list generated files for an asset', async ({ request }) => {
    if (!testAssetId) {
      test.skip();
    }

    const response = await request.get(
      `https://localhost:21371/api/assets/${testAssetId}/files`,
      { ignoreHTTPSErrors: true }
    );
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.photoId).toBe(testAssetId);
    expect(Array.isArray(data.files)).toBe(true);
    expect(data.count).toBe(data.files.length);
    
    // Verify file structure if any files exist
    if (data.files.length > 0) {
      const file = data.files[0];
      expect(file).toHaveProperty('id');
      expect(file).toHaveProperty('type');
      expect(file).toHaveProperty('modelKey');
      expect(file).toHaveProperty('format');
      expect(file).toHaveProperty('filePath');
      expect(file).toHaveProperty('generatedAt');
      
      testFileId = file.id;
    }
  });

  test('should generate depth map for an asset', async ({ request }) => {
    if (!testAssetId) {
      test.skip();
    }

    const response = await request.post(
      `https://localhost:21371/api/assets/${testAssetId}/generate`,
      {
        ignoreHTTPSErrors: true,
        data: {
          type: 'depth',
          modelKey: 'small'
        }
      }
    );
    
    expect(response.status()).toBe(200);
    
    // Response should be binary image data (PNG)
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('image/png');
    
    const buffer = await response.body();
    expect(buffer.length).toBeGreaterThan(0);
    
    // Check cache header
    const cacheHeader = response.headers()['x-asset-cache'];
    expect(cacheHeader).toBeDefined();
    expect(['hit', 'miss']).toContain(cacheHeader);
  });

  test('should download a generated file', async ({ request }) => {
    if (!testAssetId || !testFileId) {
      test.skip();
    }

    const response = await request.get(
      `https://localhost:21371/api/assets/${testAssetId}/files/${testFileId}/download`,
      { ignoreHTTPSErrors: true }
    );
    
    expect(response.status()).toBe(200);
    
    // Should return file data
    const buffer = await response.body();
    expect(buffer.length).toBeGreaterThan(0);
    
    // Content-Type and Content-Disposition headers should be set
    const contentType = response.headers()['content-type'];
    expect(contentType).toBeDefined();
    
    const contentDisposition = response.headers()['content-disposition'];
    expect(contentDisposition).toBeDefined();
    expect(contentDisposition).toContain('inline');
  });

  test('should delete a generated file', async ({ request }) => {
    // Generate a test depth map first
    if (!testAssetId) {
      test.skip();
    }

    // Generate depth
    await request.post(
      `https://localhost:21371/api/assets/${testAssetId}/generate`,
      {
        ignoreHTTPSErrors: true,
        data: {
          type: 'depth',
          modelKey: 'small'
        }
      }
    );

    // Get files to find the ID
    const filesResponse = await request.get(
      `https://localhost:21371/api/assets/${testAssetId}/files`,
      { ignoreHTTPSErrors: true }
    );
    const filesData = await filesResponse.json();
    
    if (filesData.files.length === 0) {
      test.skip();
    }

    const fileToDelete = filesData.files[0];
    
    // Delete the file
    const deleteResponse = await request.delete(
      `https://localhost:21371/api/assets/${testAssetId}/files/${fileToDelete.id}`,
      { ignoreHTTPSErrors: true }
    );
    
    expect(deleteResponse.status()).toBe(200);
    
    const data = await deleteResponse.json();
    expect(data.success).toBe(true);
    expect(data.deletedFileId).toBe(fileToDelete.id);
  });

  test('should handle 404 for non-existent file download', async ({ request }) => {
    const response = await request.get(
      '${BASE_URL}/api/assets/fake-id/files/fake-file-id/download',
      { ignoreHTTPSErrors: true }
    );
    
    expect(response.status()).toBe(404);
    
    const data = await response.json();
    expect(data.error).toBe('File not found');
  });

  test('should handle 404 for non-existent file deletion', async ({ request }) => {
    const response = await request.delete(
      '${BASE_URL}/api/assets/fake-id/files/fake-file-id',
      { ignoreHTTPSErrors: true }
    );
    
    expect(response.status()).toBe(404);
    
    const data = await response.json();
    expect(data.error).toBe('File not found');
  });

  test('should handle asset conversion request', async ({ request }) => {
    if (!testAssetId) {
      test.skip();
    }

    const response = await request.post(
      `https://localhost:21371/api/assets/${testAssetId}/convert`,
      {
        ignoreHTTPSErrors: true,
        data: {
          from: 'ply',
          to: 'ksplat'
        }
      }
    );
    
    // May be 404 if no PLY exists, or 200 if conversion succeeds
    if (response.status() === 404) {
      const data = await response.json();
      expect(data.error).toBe('No PLY file found to convert');
    } else if (response.status() === 200) {
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(['converted', 'already_converted']).toContain(data.status);
    }
  });

  test('should reject unsupported conversion formats', async ({ request }) => {
    if (!testAssetId) {
      test.skip();
    }

    const response = await request.post(
      `${BASE_URL}/api/assets/${testAssetId}/convert`,
      {
        ignoreHTTPSErrors: true,
        data: {
          from: 'ply',
          to: 'obj'
        }
      }
    );
    
    // Should be 400 Bad Request for unsupported formats
    expect(response.status()).toBe(400);
    
    const data = await response.json();
    expect(data.error).toBe('Unsupported format');
  });
});
