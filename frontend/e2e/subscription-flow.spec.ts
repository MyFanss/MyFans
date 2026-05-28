import { test, expect } from '@playwright/test';

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
  test('completes connect -> subscribe -> unlock flow with persisted client state', async ({ page }) => {
    // Connect wallet from the subscribe page
    await page.goto('/subscribe');
    await page.getByRole('button', { name: 'Connect Wallet' }).click();
    await expect(page.getByText(/GTEST1\.\.\.\d+/i)).toBeVisible({ timeout: 10_000 });

    // Subscribe to a creator
    const subscribeButton = page.getByRole('button', { name: 'Subscribe' }).first();
    await expect(subscribeButton).toBeEnabled();
    await subscribeButton.click();

    // Open gated content and verify access is unlocked from persisted subscription
    await page.goto('/content/1');
    await expect(page.getByRole('heading', { name: /Exclusive Behind the Scenes/i })).toBeVisible();
    await expect(page.locator('video')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Exclusive Content')).not.toBeVisible();
  });

  test('handles disconnected state gracefully on gated content', async ({ page }) => {
    await page.goto('/content/1');
    await expect(page.getByRole('button', { name: /Subscribe to Lena Nova/i })).toBeVisible();
    await expect(page.locator('video')).not.toBeVisible();
    await expect(page.getByText('Exclusive Content')).toBeVisible();
  });

  test('recovers from invalid persisted session state', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('myfans.wallet.session.v1', '{broken');
      window.localStorage.setItem('myfans.viewer.subscriptions.v1', '{broken');
    });

    await page.goto('/content/1');
    await expect(page.getByRole('heading', { name: /Exclusive Behind the Scenes/i })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText('Exclusive Content')).toBeVisible();
  });
});
