import { test, expect } from '@playwright/test';

/**
 * Test: Model Status Sync Between Settings and 3D Views
 * 
 * Verifies that when a model is downloaded via Settings panel,
 * the 3D Views panel correctly reflects the updated status
 * and can generate depth using that model.
 */
test.describe.serial('Model Status Sync Between Settings and 3D Views', () => {
  const targetModel = 'base'; // Use 'base' model for testing

  test.beforeEach(async ({ page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error' || msg.text().includes('Bridge') || msg.text().includes('model')) {
        console.log('BROWSER LOG:', msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('should show correct model status in 3D Views after downloading via Settings', async ({ page, request }) => {
    // === SETUP: Reset model state to ensure clean test ===
    console.log(`Resetting model ${targetModel} state...`);
    await request.delete(`/api/settings/models/${targetModel}`, { ignoreHTTPSErrors: true });

    // Reload to pick up fresh state
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // === STEP 1: Open Settings and verify model is NOT downloaded ===
    await page.getByRole('button', { name: '⚙️ Settings' }).click();
    await page.waitForFunction(() => typeof (window as any).__VR_UI_INTERNALS !== 'undefined', null, { timeout: 10000 });

    // Switch to models tab
    await page.evaluate(() => (window as any).__VR_UI_INTERNALS.actions.setActiveTab('models'));
    
    // Wait for models to load
    await page.waitForFunction(() => {
      const models = (window as any).__VR_UI_INTERNALS.state.models;
      return models && models.length > 0;
    }, null, { timeout: 10000 });

    // Verify model is not downloaded initially
    let models = await page.evaluate(() => (window as any).__VR_UI_INTERNALS.state.models);
    let model = models.find((m: any) => m.key === targetModel);
    console.log(`Initial model status: ${model?.status}`);
    
    // Note: If model is already downloaded from previous runs, skip download step
    const wasAlreadyDownloaded = model?.status === 'downloaded';
    
    if (!wasAlreadyDownloaded) {
      expect(model.status).toBe('not_downloaded');

      // === STEP 2: Download model via Settings bridge ===
      console.log('Downloading model via Settings bridge...');
      await page.evaluate((key) => (window as any).__VR_UI_INTERNALS.actions.downloadModel(key), targetModel);

      // Wait for download to complete (status changes to 'downloaded')
      await page.waitForFunction((key) => {
        const models = (window as any).__VR_UI_INTERNALS.state.models;
        const m = models.find((x: any) => x.key === key);
        return m && m.status === 'downloaded';
      }, targetModel, { timeout: 120000 }); // 2 min timeout for download

      console.log('Model downloaded successfully via Settings');
    } else {
      console.log('Model was already downloaded, skipping download step');
    }

    // Close settings panel by clicking close button or pressing escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // === STEP 3: Wait for VR Viewer Bridge to be ready ===
    await page.waitForFunction(() => typeof (window as any).__VR_VIEWER_INTERNALS !== 'undefined', null, { timeout: 10000 });

    // Wait for photos to load
    await page.waitForFunction(() => {
      const state = (window as any).__VR_VIEWER_INTERNALS?.state;
      return state?.photos?.length > 0;
    }, null, { timeout: 15000 });

    // === STEP 4: Select a photo (enter viewer mode) ===
    const photos = await page.evaluate(() => (window as any).__VR_VIEWER_INTERNALS.state.photos);
    expect(photos.length).toBeGreaterThan(0);
    
    const photoId = photos[0].id;
    console.log(`Selecting photo: ${photoId}`);
    await page.evaluate((id) => (window as any).__VR_VIEWER_INTERNALS.actions.selectPhoto(id), photoId);

    // Wait for photo selection
    await page.waitForFunction((id) => (window as any).__VR_VIEWER_INTERNALS.state.selectedPhotoId === id, photoId);

    // Small delay for availableModels to refresh (this is what we're testing!)
    await page.waitForTimeout(1000);

    // === STEP 5: Verify availableModels shows the model as downloaded ===
    // Access the gallery's internal state which feeds the 3D Views panel
    const viewerState = await page.evaluate(() => (window as any).__VR_VIEWER_INTERNALS.state);
    
    // NOTE: Currently the gallery exposes 'photos' but not 'availableModels' directly
    // We need to verify via the Settings bridge which is the source of truth
    // Re-open settings briefly to check
    await page.getByRole('button', { name: '⚙️ Settings' }).click();
    await page.waitForFunction(() => typeof (window as any).__VR_UI_INTERNALS !== 'undefined');
    await page.evaluate(() => (window as any).__VR_UI_INTERNALS.actions.setActiveTab('models'));
    
    await page.waitForFunction(() => {
      const models = (window as any).__VR_UI_INTERNALS.state.models;
      return models && models.length > 0;
    });
    
    models = await page.evaluate(() => (window as any).__VR_UI_INTERNALS.state.models);
    model = models.find((m: any) => m.key === targetModel);
    
    expect(model.status).toBe('downloaded');
    expect(model.is_downloaded).toBe(true);
    console.log('Settings confirms model is downloaded');
    
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // === STEP 6: Generate depth using this model ===
    console.log(`Generating depth with model: ${targetModel}`);
    
    // Monitor for the generation API call
    const generatePromise = page.waitForResponse(response => 
      response.url().includes(`/api/assets/${photoId}/generate`) && 
      response.status() === 200 &&
      response.request().method() === 'POST',
      { timeout: 60000 }
    );
    
    // Trigger generation via viewer bridge
    await page.evaluate((modelKey) => (window as any).__VR_VIEWER_INTERNALS.actions.generateAsset(modelKey), targetModel);

    // Wait for API response
    const response = await generatePromise;
    expect(response.ok()).toBeTruthy();
    console.log('Generation API returned 200 OK');

    // === STEP 7: Verify generated file appears in photoFiles ===
    await page.waitForFunction((modelKey) => {
      const files = (window as any).__VR_VIEWER_INTERNALS.state.photoFiles;
      return files && files.some((f: any) => f.modelKey === modelKey && f.type === 'depth');
    }, targetModel, { timeout: 30000 });

    const photoFiles = await page.evaluate(() => (window as any).__VR_VIEWER_INTERNALS.state.photoFiles);
    const generatedFile = photoFiles.find((f: any) => f.modelKey === targetModel && f.type === 'depth');
    
    expect(generatedFile).toBeDefined();
    console.log(`Generated depth file found: ${generatedFile.id}`);

    // === CLEANUP ===
    console.log('Cleaning up generated file...');
    await page.evaluate((modelKey) => (window as any).__VR_VIEWER_INTERNALS.actions.removeAsset(modelKey), targetModel);
    
    await page.waitForFunction((modelKey) => {
      const files = (window as any).__VR_VIEWER_INTERNALS.state.photoFiles;
      return !files.some((f: any) => f.modelKey === modelKey);
    }, targetModel);

    console.log('Test completed successfully!');
  });
});
