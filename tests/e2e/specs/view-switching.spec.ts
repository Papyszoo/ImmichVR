import { test, expect } from '@playwright/test';

/**
 * Test: Switching Between 3D Views (Multi-Model Depth)
 * 
 * Verifies that:
 * 1. A photo can have depth maps generated with different models
 * 2. Each model's depth map is stored independently
 * 3. The viewer can switch between different 3D views
 * 
 * Designed to be extendable for future asset types:
 * - Depth maps (current)
 * - Gaussian splats (future)
 * - Other 3D representations
 */
test.describe.serial('Switching Between 3D Views', () => {
  const MODELS = {
    FIRST: 'small',   // First model to test
    SECOND: 'base',   // Second model to test
  };
  
  // Future extensibility: add more asset types here
  const ASSET_TYPES = {
    DEPTH: 'depth',
    // SPLAT: 'splat',       // Future: Gaussian Splatting
    // MESH: 'mesh',         // Future: 3D Mesh
  };

  let testPhotoId: string;

  test.beforeEach(async ({ page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error' || msg.text().includes('depth') || msg.text().includes('generated')) {
        console.log('BROWSER:', msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Wait for viewer bridge
    await page.waitForFunction(() => typeof (window as any).__VR_VIEWER_INTERNALS !== 'undefined', null, { timeout: 15000 });

    // Wait for photos to load
    await page.waitForFunction(() => {
      const state = (window as any).__VR_VIEWER_INTERNALS?.state;
      return state?.photos?.length > 0;
    }, null, { timeout: 15000 });

    // Get first photo ID for testing
    const photos = await page.evaluate(() => (window as any).__VR_VIEWER_INTERNALS.state.photos);
    testPhotoId = photos[0].id;
    console.log(`Test photo ID: ${testPhotoId}`);

    // Select the photo to enter viewer mode
    await page.evaluate((id) => (window as any).__VR_VIEWER_INTERNALS.actions.selectPhoto(id), testPhotoId);
    await page.waitForFunction((id) => (window as any).__VR_VIEWER_INTERNALS.state.selectedPhotoId === id, testPhotoId);
  });

  test.afterEach(async ({ page }) => {
    // Cleanup: remove all generated files for this photo
    console.log('Cleaning up generated files...');
    
    const photoFiles = await page.evaluate(() => (window as any).__VR_VIEWER_INTERNALS.state.photoFiles);
    
    for (const file of photoFiles) {
      await page.evaluate((modelKey) => (window as any).__VR_VIEWER_INTERNALS.actions.removeAsset(modelKey), file.modelKey);
      await page.waitForTimeout(500);
    }
  });

  test('should generate multiple depth maps with different models', async ({ page }) => {
    // === STEP 1: Verify no existing depth maps ===
    let photoFiles = await page.evaluate(() => (window as any).__VR_VIEWER_INTERNALS.state.photoFiles);
    const initialDepthCount = photoFiles.filter((f: any) => f.type === ASSET_TYPES.DEPTH).length;
    console.log(`Initial depth maps: ${initialDepthCount}`);

    // === STEP 2: Generate depth with FIRST model ===
    console.log(`Generating depth with ${MODELS.FIRST} model...`);
    
    const firstGenPromise = page.waitForResponse(response => 
      response.url().includes(`/api/assets/${testPhotoId}/generate`) && 
      response.status() === 200,
      { timeout: 120000 }
    );
    
    await page.evaluate((modelKey) => (window as any).__VR_VIEWER_INTERNALS.actions.generateAsset(modelKey), MODELS.FIRST);
    await firstGenPromise;
    
    // Wait for state to update
    await page.waitForFunction((modelKey) => {
      const files = (window as any).__VR_VIEWER_INTERNALS.state.photoFiles;
      return files.some((f: any) => f.modelKey === modelKey && f.type === 'depth');
    }, MODELS.FIRST, { timeout: 30000 });

    photoFiles = await page.evaluate(() => (window as any).__VR_VIEWER_INTERNALS.state.photoFiles);
    const firstDepth = photoFiles.find((f: any) => f.modelKey === MODELS.FIRST && f.type === ASSET_TYPES.DEPTH);
    expect(firstDepth).toBeDefined();
    console.log(`Generated ${MODELS.FIRST} depth: ${firstDepth.id}`);

    // === STEP 3: Generate depth with SECOND model ===
    console.log(`Generating depth with ${MODELS.SECOND} model...`);
    
    const secondGenPromise = page.waitForResponse(response => 
      response.url().includes(`/api/assets/${testPhotoId}/generate`) && 
      response.status() === 200,
      { timeout: 120000 }
    );
    
    await page.evaluate((modelKey) => (window as any).__VR_VIEWER_INTERNALS.actions.generateAsset(modelKey), MODELS.SECOND);
    await secondGenPromise;
    
    // Wait for second model's depth to appear
    await page.waitForFunction((modelKey) => {
      const files = (window as any).__VR_VIEWER_INTERNALS.state.photoFiles;
      return files.some((f: any) => f.modelKey === modelKey && f.type === 'depth');
    }, MODELS.SECOND, { timeout: 30000 });

    // === STEP 4: Verify BOTH depth maps exist independently ===
    photoFiles = await page.evaluate(() => (window as any).__VR_VIEWER_INTERNALS.state.photoFiles);
    
    const depthMaps = photoFiles.filter((f: any) => f.type === ASSET_TYPES.DEPTH);
    console.log(`Total depth maps: ${depthMaps.length}`);
    
    const firstModelDepth = depthMaps.find((f: any) => f.modelKey === MODELS.FIRST);
    const secondModelDepth = depthMaps.find((f: any) => f.modelKey === MODELS.SECOND);
    
    expect(firstModelDepth).toBeDefined();
    expect(secondModelDepth).toBeDefined();
    expect(firstModelDepth.id).not.toBe(secondModelDepth.id);
    
    console.log('Both depth maps verified:');
    console.log(`  - ${MODELS.FIRST}: ${firstModelDepth.id}`);
    console.log(`  - ${MODELS.SECOND}: ${secondModelDepth.id}`);
  });

  test('should track active view model in state', async ({ page, request }) => {
    // This test prepares for the view switching feature
    // Currently, the frontend doesn't have an activeViewModel state
    // This test documents the expected behavior for future implementation
    
    // Generate at least one depth map to work with
    console.log(`Generating depth with ${MODELS.FIRST} model for switching test...`);
    
    const genPromise = page.waitForResponse(response => 
      response.url().includes(`/api/assets/${testPhotoId}/generate`) && 
      response.status() === 200,
      { timeout: 120000 }
    );
    
    await page.evaluate((modelKey) => (window as any).__VR_VIEWER_INTERNALS.actions.generateAsset(modelKey), MODELS.FIRST);
    await genPromise;
    
    // Wait for depth to appear
    await page.waitForFunction((modelKey) => {
      const files = (window as any).__VR_VIEWER_INTERNALS.state.photoFiles;
      return files.some((f: any) => f.modelKey === modelKey && f.type === 'depth');
    }, MODELS.FIRST, { timeout: 30000 });

    // Verify the photoFiles structure supports view identification
    const photoFiles = await page.evaluate(() => (window as any).__VR_VIEWER_INTERNALS.state.photoFiles);
    const depthFile = photoFiles.find((f: any) => f.modelKey === MODELS.FIRST);
    
    // Each file should have enough info to construct a view option
    expect(depthFile).toBeDefined();
    expect(depthFile.type).toBe(ASSET_TYPES.DEPTH);
    expect(depthFile.modelKey).toBe(MODELS.FIRST);
    expect(depthFile.format).toBeDefined();
    expect(depthFile.id).toBeDefined();
    
    console.log('File structure supports view identification:');
    console.log(JSON.stringify(depthFile, null, 2));
    
    // FUTURE: When view switching is implemented, add these assertions:
    // - await page.evaluate((modelKey) => window.__VR_VIEWER_INTERNALS.actions.selectView(modelKey), MODELS.FIRST);
    // - expect(await page.evaluate(() => window.__VR_VIEWER_INTERNALS.state.activeViewModel)).toBe(MODELS.FIRST);
  });

  /**
   * FUTURE TEST: Switch between different 3D view types
   * 
   * test('should switch between depth and splat views', async ({ page }) => {
   *   // Generate depth map
   *   await generateAsset(page, testPhotoId, ASSET_TYPES.DEPTH, MODELS.FIRST);
   *   
   *   // Generate Gaussian splat
   *   await generateAsset(page, testPhotoId, ASSET_TYPES.SPLAT, 'gs-fast');
   *   
   *   // Switch to depth view
   *   await page.evaluate(() => window.__VR_VIEWER_INTERNALS.actions.selectView('small', 'depth'));
   *   expect(await page.evaluate(() => window.__VR_VIEWER_INTERNALS.state.activeViewType)).toBe('depth');
   *   
   *   // Switch to splat view
   *   await page.evaluate(() => window.__VR_VIEWER_INTERNALS.actions.selectView('gs-fast', 'splat'));
   *   expect(await page.evaluate(() => window.__VR_VIEWER_INTERNALS.state.activeViewType)).toBe('splat');
   * });
   */
});
