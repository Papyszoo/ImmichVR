import { test, expect } from '@playwright/test';

test.describe.serial('Model Management VR Bridge', () => {
  test.beforeEach(async ({ page }) => {
    // Listen for console logs
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    
    // Start at home page (VR/3D mode default)
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    // Open Settings Panel using the trigger button (this ensures the component is 'open' and logic is active)
    await page.getByRole('button', { name: '⚙️ Settings' }).click();

    // Wait for the 3D UI Bridge to be initialized attached to window
    // This confirms the 3D component (UIKitSettingsPanel) is mounted and running
    await page.waitForFunction(() => typeof (window as any).__VR_UI_INTERNALS !== 'undefined');
  });

  test('should expose 3D UI state via bridge', async ({ page }) => {
    const internalState = await page.evaluate(() => (window as any).__VR_UI_INTERNALS.state);
    
    expect(internalState.isOpen).toBe(true);
    expect(internalState.activeTab).toBeDefined();
    // Default tab might be 'layout'
    console.log('Active Tab:', internalState.activeTab);
  });

  test('should list available models via bridge state', async ({ page }) => {
    // Switch to models tab logic
    await page.evaluate(() => (window as any).__VR_UI_INTERNALS.actions.setActiveTab('models'));

    // Wait for models to populate (async fetch)
    await page.waitForFunction(() => {
        const models = (window as any).__VR_UI_INTERNALS.state.models;
        return models && models.length > 0;
    });

    const models = await page.evaluate(() => (window as any).__VR_UI_INTERNALS.state.models);
    
    // Verify we have the expected models
    expect(models).toEqual(
        expect.arrayContaining([
            expect.objectContaining({ key: 'small', name: 'Small' }),
            expect.objectContaining({ key: 'base', name: 'Base' }),
            expect.objectContaining({ key: 'large', name: 'Large' }),
        ])
    );
    
    console.log('Models found:', models.map((m: any) => m.name));
  });

  test('should download and activate a model via bridge actions', async ({ page, request }) => {
    // Reset 'large' model state to ensure test is deterministic
    await request.delete('/api/settings/models/large');
    
    // Refresh page to get fresh state
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('button', { name: '⚙️ Settings' }).click();
    await page.waitForFunction(() => typeof (window as any).__VR_UI_INTERNALS !== 'undefined');

    // Switch to models tab
    await page.evaluate(() => (window as any).__VR_UI_INTERNALS.actions.setActiveTab('models'));
    
    // Verify 'large' is initially NOT downloaded
    await page.waitForFunction(() => {
        const models = (window as any).__VR_UI_INTERNALS.state.models;
        return models && models.length > 0;
    });

    let models = await page.evaluate(() => (window as any).__VR_UI_INTERNALS.state.models);
    let largeModel = models.find((m: any) => m.key === 'large');
    expect(largeModel).toBeDefined();
    expect(largeModel.status).toBe('not_downloaded');

    // Trigger Download Action via Bridge
    console.log('Triggering download via Bridge...');
    await page.evaluate(() => (window as any).__VR_UI_INTERNALS.actions.downloadModel('large'));

    // Wait for status to change to 'downloaded'
    await page.waitForFunction(() => {
        const models = (window as any).__VR_UI_INTERNALS.state.models;
        const large = models.find((m: any) => m.key === 'large');
        return large && large.status === 'downloaded';
    }, { timeout: 15000 });

    // Verify Is Downloaded
    models = await page.evaluate(() => (window as any).__VR_UI_INTERNALS.state.models);
    largeModel = models.find((m: any) => m.key === 'large');
    expect(largeModel.status).toBe('downloaded');

    // Now Activate it logic
    console.log('Triggering activation via Bridge...');
    await page.evaluate(() => (window as any).__VR_UI_INTERNALS.actions.activateModel('large'));

    // Wait for active state? The bridge doesn't explicitly expose 'active' in the list 
    // but the model object has 'is_loaded' property mapped from API?
    // Let's check the API response mapping in UIKitSettingsPanel.jsx:
    // mappedModels ... { ...m, status: ... }
    // The API returns 'is_loaded'.
    
    // Wait for model to be loaded
    await page.waitForFunction(() => {
        const models = (window as any).__VR_UI_INTERNALS.state.models;
        const large = models.find((m: any) => m.key === 'large');
        return large && large.is_loaded === true;
    }, { timeout: 10000 });
    
    console.log('Model activated successfully!');
  });
});
