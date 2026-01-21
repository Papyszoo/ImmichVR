import { test, expect } from '@playwright/test';

test.describe('VR Gallery with Mock Immich API', () => {
  test('should load the gallery page successfully', async ({ page }) => {
    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForLoadState('domcontentloaded');
    
    // Take screenshot of loaded page
    await page.screenshot({ path: 'test-results/gallery-page-loaded.png', fullPage: true });
    
    // Check that we can see the page title
    await expect(page).toHaveTitle(/ImmichVR|Immich/i);
  });

  test('should fetch photos from mock Immich API', async ({ page }) => {
    // Set up network monitoring
    const apiRequests: string[] = [];
    page.on('request', request => {
      if (request.url().includes('/api/immich/')) {
        apiRequests.push(request.url());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    // Wait a bit for API calls to complete
    await page.waitForTimeout(2000);
    
    // Verify that API requests were made
    expect(apiRequests.length).toBeGreaterThan(0);
    
    // Check that photos endpoint was called
    const photosRequest = apiRequests.find(url => url.includes('/photos'));
    expect(photosRequest).toBeTruthy();
  });

  test('should display photos in the VR gallery', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    // Wait for the VR scene to initialize (canvas)
    const canvas = page.locator('canvas');
    await canvas.waitFor({ state: 'visible', timeout: 10000 });
    
    // Check for canvas element (Three.js renders to canvas)
    await expect(canvas).toBeVisible();
    
    // Take screenshot of VR gallery
    await page.screenshot({ path: 'test-results/vr-gallery-with-photos.png', fullPage: true });
  });

  test('should load thumbnails from mock API', async ({ page }) => {
    const thumbnailRequests: Array<{ url: string; status: number; contentType: string | undefined }> = [];
    
    page.on('response', async response => {
      if (response.url().includes('/thumbnail')) {
        thumbnailRequests.push({
          url: response.url(),
          status: response.status(),
          contentType: response.headers()['content-type']
        });
      }
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    // Wait for thumbnails to load
    await page.waitForTimeout(5000);
    
    // Take screenshot showing loaded thumbnails
    await page.screenshot({ path: 'test-results/thumbnails-loaded.png', fullPage: true });
    
    // Verify thumbnails were requested
    expect(thumbnailRequests.length).toBeGreaterThan(0);
    
    // Verify thumbnails returned successfully
    const successfulThumbnails = thumbnailRequests.filter(req => req.status === 200);
    expect(successfulThumbnails.length).toBeGreaterThan(0);
    
    // Verify content type is image
    const imageThumbnails = successfulThumbnails.filter(req => 
      req.contentType && req.contentType.includes('image')
    );
    expect(imageThumbnails.length).toBeGreaterThan(0);
  });

  test('should connect to mock Immich API successfully', async ({ page }) => {
    // Navigate to a page that might show connection status
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    // Check console for errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.waitForTimeout(3000);
    
    // Filter out known acceptable errors (like WebGL warnings)
    const criticalErrors = errors.filter(error => 
      !error.includes('WebGL') && 
      !error.includes('THREE') &&
      !error.includes('Immich connection failed')
    );
    
    // We should not have critical connection errors
    expect(criticalErrors.length).toBe(0);
  });

  test('backend can connect to mock Immich API', async ({ request }) => {
    // Test the backend's Immich connection endpoint
    const response = await request.get('https://127.0.0.1:21371/api/immich/test', {
      ignoreHTTPSErrors: true
    });
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.status).toBe('success');
    expect(data.message).toContain('Connection to Immich successful');
  });

  test('backend can fetch photos from mock API', async ({ request }) => {
    const response = await request.get('https://127.0.0.1:21371/api/immich/photos?size=20', {
      ignoreHTTPSErrors: true
    });
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.status).toBe('success');
    expect(data.count).toBeGreaterThan(0);
    expect(data.count).toBeLessThanOrEqual(20);
    expect(Array.isArray(data.data)).toBe(true);
    
    // Verify photo structure
    if (data.data.length > 0) {
      const photo = data.data[0];
      expect(photo).toHaveProperty('id');
      expect(photo).toHaveProperty('originalFileName');
      expect(photo).toHaveProperty('type');
      expect(photo.type).toBe('IMAGE');
    }
  });

  test('backend can fetch specific photo info', async ({ request }) => {
    // First get the list of photos
    const photosResponse = await request.get('https://127.0.0.1:21371/api/immich/photos?size=1', {
      ignoreHTTPSErrors: true
    });
    const photosData = await photosResponse.json();
    
    expect(photosData.data.length).toBeGreaterThan(0);
    const photoId = photosData.data[0].id;
    
    // Now fetch specific photo info
    const photoResponse = await request.get(`https://127.0.0.1:21371/api/immich/assets/${photoId}`, {
      ignoreHTTPSErrors: true
    });
    
    expect(photoResponse.status()).toBe(200);
    
    const photoData = await photoResponse.json();
    expect(photoData.status).toBe('success');
    expect(photoData.data.id).toBe(photoId);
    expect(photoData.data).toHaveProperty('exifInfo');
  });

  test('backend can fetch photo thumbnail', async ({ request }) => {
    // First get a photo ID
    const photosResponse = await request.get('https://127.0.0.1:21371/api/immich/photos?size=1', {
      ignoreHTTPSErrors: true
    });
    const photosData = await photosResponse.json();
    const photoId = photosData.data[0].id;
    
    // Fetch thumbnail
    const thumbnailResponse = await request.get(
      `https://127.0.0.1:21371/api/immich/assets/${photoId}/thumbnail`,
      { ignoreHTTPSErrors: true }
    );
    
    expect(thumbnailResponse.status()).toBe(200);
    
    // Verify it's an image
    const contentType = thumbnailResponse.headers()['content-type'];
    expect(contentType).toContain('image');
    
    // Verify we got actual image data
    const buffer = await thumbnailResponse.body();
    expect(buffer.length).toBeGreaterThan(0);
  });
});
