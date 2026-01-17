import { test, expect } from '@playwright/test';

test.describe.serial('Generic Asset Generation via VR Bridge', () => {
  test.beforeEach(async ({ page }) => {
    // Listen for console logs
    page.on('console', msg => {
        if (msg.type() === 'error' || msg.text().includes('Bridge')) {
             console.log('BROWSER LOG:', msg.text());
        }
    });
    
    // Start at home page
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    // Wait for the Gallery Bridge to be initialized attached to window
    // This might take a moment as photos load
    await page.waitForFunction(() => typeof (window as any).__VR_VIEWER_INTERNALS !== 'undefined', null, { timeout: 15000 });
  });

  test('should generate depth map for a photo via bridge', async ({ page, request }) => {
    // 1. Wait for photos to be populated in the bridge (Async load)
    await page.waitForFunction(() => {
        const state = (window as any).__VR_VIEWER_INTERNALS?.state;
        return state?.photos?.length > 0;
    }, null, { timeout: 15000 });

    // Get the state now that we know photos exist
    const internalState = await page.evaluate(() => (window as any).__VR_VIEWER_INTERNALS.state);
    const photos = internalState.photos;
    expect(photos.length).toBeGreaterThan(0);
    
    const targetPhoto = photos[0];
    const photoId = targetPhoto.id;
    console.log(`Targeting photo: ${photoId}`);

    // Clean up any existing files for this photo first (Resets state)
    // We can use the Bridge action 'removeAsset' or API directly. Let's use API to be sure.
    // However, modelKey 'small' is what we likely generate.
    // Let's rely on the verification step to see if it exists, or just try to delete blindly.
    const cleanupRes = await request.delete(`/api/assets/${photoId}/files/cleanup_test_stub`, { ignoreHTTPSErrors: true });
    // Note: Above is just a stub call, real cleanup would need to list then delete.
    // For now, let's assume we can remove the 'small' model depth if it exists via Bridge later or just overwrite.
    
    // 2. Select the photo (Enter Viewer Mode)
    await page.evaluate((id) => (window as any).__VR_VIEWER_INTERNALS.actions.selectPhoto(id), photoId);
    
    // Wait for selection state
    await page.waitForFunction((id) => (window as any).__VR_VIEWER_INTERNALS.state.selectedPhotoId === id, photoId);
    
    // 3. Trigger Generation (Small Model)
    console.log('Triggering generation via Bridge...');
    
    // Monitor for the API call
    const generatePromise = page.waitForResponse(response => 
      response.url().includes(`/api/assets/${photoId}/generate`) && 
      response.status() === 200 &&
      response.request().method() === 'POST'
    );
    
    // Action
    await page.evaluate(() => (window as any).__VR_VIEWER_INTERNALS.actions.generateAsset('small'));

    // Wait for network response
    const response = await generatePromise;
    expect(response.ok()).toBeTruthy();
    console.log('Generation API returned 200 OK');

    // 4. Verify State Update
    // The component should re-fetch files and update state.photoFiles
    await page.waitForFunction((modelKey) => {
        const files = (window as any).__VR_VIEWER_INTERNALS.state.photoFiles;
        return files.some((f: any) => f.modelKey === modelKey && f.type === 'depth');
    }, 'small', { timeout: 30000 });
    
    const files = await page.evaluate(() => (window as any).__VR_VIEWER_INTERNALS.state.photoFiles);
    const generatedFile = files.find((f: any) => f.modelKey === 'small' && f.type === 'depth');
    
    expect(generatedFile).toBeDefined();
    expect(generatedFile.format).toBe('png'); // or jpg depending on backend
    console.log(`Generated file found: ${generatedFile.id}`);

    // 5. Cleanup (Remove the asset)
    console.log('Cleaning up...');
    await page.evaluate((modelKey) => (window as any).__VR_VIEWER_INTERNALS.actions.removeAsset(modelKey), 'small');
    
    // Verify removal from state
    await page.waitForFunction((modelKey) => {
        const files = (window as any).__VR_VIEWER_INTERNALS.state.photoFiles;
        return !files.some((f: any) => f.modelKey === modelKey);
    }, 'small');
    
    console.log('Cleanup successful');
  });
});
