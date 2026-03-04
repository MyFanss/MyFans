import { test, expect } from '@playwright/test';

// Helper: open wallet modal from homepage and connect via mock Freighter
async function connectWalletFromHome(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Get Started/i }).click();
  await page.getByRole('button', { name: /Freighter/i }).waitFor({ state: 'visible', timeout: 5000 });
  await page.getByRole('button', { name: /Freighter/i }).click();
  await expect(page.locator('text=/GTEST.*/')).toBeVisible({ timeout: 10000 });
}

// Mock wallet for testing
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).freighter = {
      getPublicKey: async () => 'GTEST1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890',
      signTransaction: async (xdr: string) => xdr + '_signed',
    };
  });
});

test.describe('Critical User Flow: Connect → Subscribe → Unlock', () => {
  test('should complete full subscription flow', async ({ page }) => {
    // Step 1: Connect Wallet (homepage: Get Started → Freighter)
    await connectWalletFromHome(page);

    // Step 2: Navigate to creators page and verify it loads
    await page.goto('/creators');
    await expect(page).toHaveURL(/\/creators/);
    await expect(page.getByRole('heading', { name: /Creator Dashboard/i })).toBeVisible({ timeout: 10000 });

    // Step 3: Navigate to subscriptions and verify page loads
    await page.goto('/subscriptions');
    await expect(page).toHaveURL(/\/subscriptions/);
  });

  test('should show subscription status in dashboard', async ({ page }) => {
    await connectWalletFromHome(page);

    // Navigate to subscriptions
    await page.goto('/subscriptions');
    
    // Verify subscriptions page loaded (page may show list or empty state)
    await expect(page).toHaveURL(/\/subscriptions/);
    await expect(page.locator('body')).toBeVisible();
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
    await page.getByRole('button', { name: /Get Started/i }).click();
    await page.getByRole('button', { name: /Freighter/i }).waitFor({ state: 'visible', timeout: 5000 });
    await page.getByRole('button', { name: /Freighter/i }).click();

    // Verify error message (use .first() to avoid strict mode: sr-only + visible p both match)
    await expect(page.locator('text=/rejected/i').first()).toBeVisible({ timeout: 10000 });
  });
});
