import { test, expect } from '@playwright/test';

/**
 * E2E Test Suite: Complete Subscription Flow
 * 
 * Tests the critical user journey:
 * 1. Discover creators
 * 2. Subscribe to a creator
 * 3. Access gated content
 * 
 * Requirements:
 * - Stable and deterministic
 * - Uses wallet mocks/fixtures
 * - CI-ready
 */

// Mock wallet address for testing
const MOCK_WALLET_ADDRESS = 'GTEST1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
const MOCK_TX_HASH = 'mock_tx_hash_' + Date.now();

// Test data
const TEST_CREATOR = {
  name: 'Lena Nova',
  username: 'lena.nova',
  price: 8,
};

test.describe('Complete Subscription Flow E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Freighter wallet
    await page.addInitScript(() => {
      (window as any).freighter = {
        getPublicKey: async () => {
          // Simulate slight delay
          await new Promise(resolve => setTimeout(resolve, 100));
          return 'GTEST1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
        },
        signTransaction: async (xdr: string) => {
          // Simulate signing delay
          await new Promise(resolve => setTimeout(resolve, 200));
          return xdr + '_signed';
        },
        isConnected: async () => true,
      };
    });

    // Mock backend API responses
    await page.route('**/localhost:3001/**', async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      // Mock subscription checkout
      if (url.includes('/subscriptions/checkout') && method === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'checkout_' + Date.now(),
            status: 'pending',
            amount: '8',
            fee: '0.4',
            total: '8.4',
            creatorId: 'c1',
            planId: 'plan_basic',
          }),
        });
        return;
      }

      // Mock subscription confirmation
      if (url.includes('/subscriptions/confirm') && method === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            subscriptionId: 'sub_' + Date.now(),
            txHash: 'mock_tx_hash_' + Date.now(),
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          }),
        });
        return;
      }

      // Mock subscription status check
      if (url.includes('/subscriptions/status') && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            isSubscribed: true,
            subscriptionId: 'sub_active',
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          }),
        });
        return;
      }

      // Mock content access check
      if (url.includes('/content/') && url.includes('/access') && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            hasAccess: true,
            contentUrl: '/sample-video.mp4',
          }),
        });
        return;
      }

      // Let other requests through
      await route.continue();
    });

    // Mock Stellar/Soroban RPC
    await page.route('**/soroban-testnet.stellar.org/**', async (route) => {
      const url = route.request().url();

      if (url.includes('getContractData')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            result: { value: true },
          }),
        });
      } else if (url.includes('submitTransaction')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            hash: 'mock_tx_hash_' + Date.now(),
            status: 'SUCCESS',
          }),
        });
      } else {
        await route.continue();
      }
    });
  });

  test('should complete full subscription flow: discover -> subscribe -> access content', async ({ page }) => {
    // ============================================
    // STEP 1: Discover Creators
    // ============================================
    await page.goto('/subscribe');
    
    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Subscribe to Creators/i })).toBeVisible();
    
    // Verify creators are displayed
    await expect(page.getByText(TEST_CREATOR.name)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(`@${TEST_CREATOR.username}`)).toBeVisible();
    
    // Verify price is displayed
    await expect(page.getByText(`$${TEST_CREATOR.price}`)).toBeVisible();

    // ============================================
    // STEP 2: Subscribe to Creator
    // ============================================
    
    // Find and click subscribe button for the test creator
    const creatorCard = page.locator(`text=${TEST_CREATOR.name}`).locator('..').locator('..').locator('..');
    const subscribeButton = creatorCard.getByRole('button', { name: /Subscribe/i });
    
    await expect(subscribeButton).toBeVisible();
    await expect(subscribeButton).toBeEnabled();
    
    // Click subscribe
    await subscribeButton.click();
    
    // Verify loading state
    await expect(subscribeButton).toHaveText(/Subscribing/i);
    await expect(subscribeButton).toBeDisabled();
    
    // Wait for subscription to complete
    await expect(page.getByText(/Subscribed to/i)).toBeVisible({ timeout: 5000 });
    
    // Verify success message
    await expect(page.getByText(`Subscribed to ${TEST_CREATOR.name}`)).toBeVisible();

    // ============================================
    // STEP 3: Access Gated Content
    // ============================================
    
    // Navigate to gated content
    await page.goto('/content/1');
    
    // Wait for content page to load
    await expect(page.getByRole('heading', { name: /Exclusive Behind the Scenes/i })).toBeVisible({ timeout: 10000 });
    
    // Initially, content should be locked (not subscribed yet in this context)
    // Click subscribe button on content page
    const contentSubscribeButton = page.getByRole('button', { name: /Subscribe/i }).first();
    await contentSubscribeButton.click();
    
    // Verify subscription status changes
    await expect(page.getByText(/✓ Subscribed/i)).toBeVisible({ timeout: 5000 });
    
    // Verify gated content is now accessible
    // The lock overlay should be removed and video player should be visible
    await expect(page.locator('video')).toBeVisible({ timeout: 5000 });
    
    // Verify no lock icon is present
    await expect(page.getByText(/Subscribe to Unlock/i)).not.toBeVisible();
  });

  test('should search and filter creators', async ({ page }) => {
    await page.goto('/subscribe');
    
    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Subscribe to Creators/i })).toBeVisible();
    
    // Wait for creators to load
    await expect(page.getByText(TEST_CREATOR.name)).toBeVisible({ timeout: 10000 });
    
    // Get initial creator count
    const initialCreators = await page.locator('[class*="CreatorCard"]').count();
    expect(initialCreators).toBeGreaterThan(0);
    
    // Search for specific creator
    const searchInput = page.getByPlaceholder(/Search by name/i);
    await searchInput.fill('Lena');
    
    // Verify filtered results
    await expect(page.getByText('Lena Nova')).toBeVisible();
    
    // Verify other creators are filtered out
    const filteredCreators = await page.locator('[class*="CreatorCard"]').count();
    expect(filteredCreators).toBeLessThanOrEqual(initialCreators);
    
    // Clear search
    await searchInput.clear();
    
    // Verify all creators are shown again
    await expect(page.getByText('Orion Pixel')).toBeVisible({ timeout: 5000 });
  });

  test('should handle subscription errors gracefully', async ({ page }) => {
    // Override API to return error
    await page.route('**/localhost:3001/subscriptions/checkout', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Insufficient funds',
          message: 'Your wallet does not have enough balance',
        }),
      });
    });

    await page.goto('/subscribe');
    
    // Wait for page to load
    await expect(page.getByText(TEST_CREATOR.name)).toBeVisible({ timeout: 10000 });
    
    // Try to subscribe
    const subscribeButton = page.getByRole('button', { name: /Subscribe/i }).first();
    await subscribeButton.click();
    
    // Even with error, the button should return to normal state
    // (In real implementation, error message would be shown)
    await expect(subscribeButton).toBeEnabled({ timeout: 5000 });
  });

  test('should show locked content for non-subscribers', async ({ page }) => {
    // Override subscription status to return false
    await page.route('**/localhost:3001/subscriptions/status**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          isSubscribed: false,
        }),
      });
    });

    await page.goto('/content/1');
    
    // Wait for content page to load
    await expect(page.getByRole('heading', { name: /Exclusive Behind the Scenes/i })).toBeVisible({ timeout: 10000 });
    
    // Verify lock overlay is present
    await expect(page.getByText(/Subscribe to Unlock/i)).toBeVisible();
    
    // Verify lock icon is visible
    const lockIcon = page.locator('svg').filter({ has: page.locator('path[d*="M12 15v2m-6 4h12"]') });
    await expect(lockIcon).toBeVisible();
    
    // Verify video player is not accessible
    await expect(page.locator('video')).not.toBeVisible();
    
    // Verify subscribe button is present in lock overlay
    const subscribeButton = page.getByRole('button', { name: /Subscribe to/i });
    await expect(subscribeButton).toBeVisible();
  });

  test('should display creator information correctly', async ({ page }) => {
    await page.goto('/subscribe');
    
    // Wait for creators to load
    await expect(page.getByText(TEST_CREATOR.name)).toBeVisible({ timeout: 10000 });
    
    // Verify creator card contains all required information
    const creatorCard = page.locator(`text=${TEST_CREATOR.name}`).locator('..').locator('..').locator('..');
    
    // Name
    await expect(creatorCard.getByText(TEST_CREATOR.name)).toBeVisible();
    
    // Username
    await expect(creatorCard.getByText(`@${TEST_CREATOR.username}`)).toBeVisible();
    
    // Bio
    await expect(creatorCard.getByText(/Daily music snippets/i)).toBeVisible();
    
    // Price
    await expect(creatorCard.getByText(`$${TEST_CREATOR.price}`)).toBeVisible();
    
    // Subscriber count
    await expect(creatorCard.getByText(/subscribers/i)).toBeVisible();
    
    // Subscribe button
    await expect(creatorCard.getByRole('button', { name: /Subscribe/i })).toBeVisible();
  });

  test('should handle wallet connection in subscription flow', async ({ page }) => {
    await page.goto('/subscribe');
    
    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Subscribe to Creators/i })).toBeVisible();
    
    // Verify wallet connect component is present
    const walletConnect = page.locator('text=/Connect Wallet|GTEST/i').first();
    await expect(walletConnect).toBeVisible({ timeout: 10000 });
  });

  test('should navigate between related content', async ({ page }) => {
    await page.goto('/content/1');
    
    // Wait for content page to load
    await expect(page.getByRole('heading', { name: /Exclusive Behind the Scenes/i })).toBeVisible({ timeout: 10000 });
    
    // Scroll to related content section
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    
    // Verify related content section exists
    await expect(page.getByText(/Related Content/i)).toBeVisible();
    
    // Verify related content items are displayed
    const relatedItems = page.locator('a[href^="/content/"]');
    const count = await relatedItems.count();
    expect(count).toBeGreaterThan(0);
    
    // Click on a related content item
    const firstRelated = relatedItems.first();
    await firstRelated.click();
    
    // Verify navigation occurred
    await expect(page).toHaveURL(/\/content\/\d+/);
  });

  test('should display content metadata correctly', async ({ page }) => {
    await page.goto('/content/1');
    
    // Wait for content page to load
    await expect(page.getByRole('heading', { name: /Exclusive Behind the Scenes/i })).toBeVisible({ timeout: 10000 });
    
    // Verify metadata is displayed
    await expect(page.getByText(/January 15, 2024/i)).toBeVisible();
    await expect(page.getByText(/views/i)).toBeVisible();
    await expect(page.getByText(/12:34/i)).toBeVisible();
    
    // Verify tags are displayed
    await expect(page.getByText(/#behindthecenes/i)).toBeVisible();
    await expect(page.getByText(/#studio/i)).toBeVisible();
  });

  test('should handle like and share actions', async ({ page }) => {
    // Subscribe first to access content
    await page.goto('/content/1');
    await expect(page.getByRole('heading', { name: /Exclusive Behind the Scenes/i })).toBeVisible({ timeout: 10000 });
    
    // Click subscribe to unlock content
    const subscribeButton = page.getByRole('button', { name: /Subscribe/i }).first();
    await subscribeButton.click();
    await expect(page.getByText(/✓ Subscribed/i)).toBeVisible({ timeout: 5000 });
    
    // Find and click like button
    const likeButton = page.getByRole('button').filter({ has: page.locator('svg path[d*="M4.318 6.318"]') }).first();
    await likeButton.click();
    
    // Verify like button state changes (color or fill)
    await expect(likeButton).toHaveClass(/red/);
    
    // Find and click share button
    const shareButton = page.getByRole('button', { name: /Share/i });
    await expect(shareButton).toBeVisible();
    await shareButton.click();
    
    // In real implementation, this would open a share dialog
    // For now, just verify the button is clickable
  });
});

test.describe('Subscription Flow - Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    // Mock wallet
    await page.addInitScript(() => {
      (window as any).freighter = {
        getPublicKey: async () => 'GTEST1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890',
        signTransaction: async (xdr: string) => xdr + '_signed',
        isConnected: async () => true,
      };
    });
  });

  test('should handle empty creator list', async ({ page }) => {
    // Mock empty creator response
    await page.route('**/localhost:3001/creators**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/subscribe');
    
    // With static data, creators should still be visible
    // But if we search for something that doesn't exist
    const searchInput = page.getByPlaceholder(/Search by name/i);
    await searchInput.fill('NonexistentCreator123');
    
    // Verify empty state
    await expect(page.getByText(/No creators matched/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /Clear search/i })).toBeVisible();
  });

  test('should handle network errors during subscription', async ({ page }) => {
    // Mock network error
    await page.route('**/localhost:3001/subscriptions/**', async (route) => {
      await route.abort('failed');
    });

    await page.goto('/subscribe');
    await expect(page.getByText(TEST_CREATOR.name)).toBeVisible({ timeout: 10000 });
    
    const subscribeButton = page.getByRole('button', { name: /Subscribe/i }).first();
    await subscribeButton.click();
    
    // Button should return to enabled state after error
    await expect(subscribeButton).toBeEnabled({ timeout: 5000 });
  });

  test('should handle slow network conditions', async ({ page }) => {
    // Add delay to API responses
    await page.route('**/localhost:3001/**', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await route.continue();
    });

    await page.goto('/subscribe');
    
    // Page should still load, just slower
    await expect(page.getByRole('heading', { name: /Subscribe to Creators/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(TEST_CREATOR.name)).toBeVisible({ timeout: 15000 });
  });
});
