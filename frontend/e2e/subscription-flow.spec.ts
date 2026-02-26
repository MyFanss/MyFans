import { test, expect } from '@playwright/test';

// Mock wallet for testing
test.beforeEach(async ({ page }) => {
  // Mock Freighter wallet
  await page.addInitScript(() => {
    (window as any).freighter = {
      getPublicKey: async () => 'GTEST1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890',
      signTransaction: async (xdr: string) => xdr + '_signed',
    };
  });
});

test.describe('Critical User Flow: Connect → Subscribe → Unlock', () => {
  test('should complete full subscription flow', async ({ page }) => {
    // Step 1: Connect Wallet
    await page.goto('/');
    await page.click('text=Connect Wallet');
    
    // Verify wallet connected
    await expect(page.locator('text=/GTEST.*/')).toBeVisible({ timeout: 5000 });
    
    // Step 2: Navigate to creator
    await page.goto('/creators');
    await page.click('[data-testid="creator-card"]').first();
    
    // Step 3: Subscribe to creator
    await page.click('text=Subscribe');
    
    // Select plan
    await page.click('[data-testid="plan-card"]').first();
    
    // Confirm subscription
    await page.click('text=Confirm Subscription');
    
    // Wait for transaction to complete (mocked)
    await expect(page.locator('text=/Subscription.*Success/i')).toBeVisible({ timeout: 10000 });
    
    // Step 4: Unlock content
    await page.goto('/content/1');
    
    // Verify content is unlocked
    await expect(page.locator('[data-testid="locked-content"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="content-viewer"]')).toBeVisible();
    
    // Verify no errors
    const errors = page.locator('[role="alert"]');
    await expect(errors).toHaveCount(0);
  });

  test('should show subscription status in dashboard', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Connect Wallet');
    
    // Navigate to subscriptions
    await page.goto('/subscriptions');
    
    // Verify subscription appears
    await expect(page.locator('[data-testid="subscription-item"]')).toBeVisible();
    await expect(page.locator('text=/Active/i')).toBeVisible();
  });

  test('should handle wallet rejection gracefully', async ({ page }) => {
    // Override mock to reject
    await page.addInitScript(() => {
      (window as any).freighter = {
        getPublicKey: async () => {
          throw new Error('User rejected');
        },
      };
    });

    await page.goto('/');
    await page.click('text=Connect Wallet');
    
    // Verify error message
    await expect(page.locator('text=/rejected/i')).toBeVisible();
  });
});
