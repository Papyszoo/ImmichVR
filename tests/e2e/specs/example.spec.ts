import { test, expect } from '@playwright/test';

test('homepage loads successfully', async ({ page }) => {
  await page.goto('/');
  
  // Wait for the page to load
  await page.waitForLoadState('networkidle');
  
  // Check that we can see some content
  await expect(page).toHaveTitle(/ImmichVR|Immich/i);
});

test('app loads without errors', async ({ page }) => {
  const response = await page.goto('/');
  
  // Check that we got a successful response
  expect(response?.status()).toBe(200);
  
  // Wait for the page to load
  await page.waitForLoadState('networkidle');
});
