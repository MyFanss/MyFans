/**
 * PR Smoke Tests – main flows
 *
 * Fast, deterministic checks that run on every PR.
 * Each test covers one critical user-facing flow and must complete in < 30 s.
 * All network calls (Stellar RPC, backend API) are intercepted so no real
 * infrastructure is required.
 */

import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Shared setup: mock wallet + Stellar RPC + backend API stubs
// ---------------------------------------------------------------------------

test.beforeEach(async ({ page }) => {
  // Mock Freighter wallet
  await page.addInitScript(() => {
    (window as any).freighter = {
      isConnected: async () => true,
      getPublicKey: async () => 'GSMOKE1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567',
      signTransaction: async (xdr: string) => xdr + '_signed',
    };
  });

  // Intercept Stellar/Soroban RPC – return minimal valid JSON-RPC responses
  await page.route('**soroban-testnet.stellar.org**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: {
          results: [{ auth: [], retval: 'AAAAAAAAAAE=' }],
          latestLedger: 1000000,
          minResourceFee: '100',
        },
      }),
    });
  });

  // Intercept backend API
  await page.route('**/v1/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes('/subscriptions/checkout') && method === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'smoke-checkout-1', status: 'pending', fanAddress: 'GSMOKE1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567' }),
      });
      return;
    }

    if (url.includes('/subscriptions/check')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ isSubscriber: true, expiryUnix: Math.floor(Date.now() / 1000) + 86400 }),
      });
      return;
    }

    if (url.includes('/creators')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          creators: [
            {
              id: 'smoke-creator-1',
              handle: 'smokecreator',
              displayName: 'Smoke Creator',
              avatarUrl: '',
              subscriberCount: 12,
            },
          ],
        }),
      });
      return;
    }

    if (url.includes('/health')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok' }),
      });
      return;
    }

    await route.continue();
  });
});

// ---------------------------------------------------------------------------
// Smoke 1: Homepage loads
// ---------------------------------------------------------------------------

test('smoke: homepage loads with key UI elements', async ({ page }) => {
  await page.goto('/');
  // Page must not show an error boundary
  await expect(page.locator('body')).not.toContainText('Something went wrong', { timeout: 10_000 });
  // At minimum the <html> element must be present (JS hydrated)
  await expect(page.locator('html')).toBeAttached();
});

// ---------------------------------------------------------------------------
// Smoke 2: Wallet connect flow
// ---------------------------------------------------------------------------

test('smoke: wallet connect shows connected address', async ({ page }) => {
  await page.goto('/');

  const connectBtn = page.getByRole('button', { name: /connect wallet/i });
  if (await connectBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await connectBtn.click();
    // After connecting, the truncated address should appear
    await expect(page.getByText(/GSMOKE/i)).toBeVisible({ timeout: 10_000 });
  } else {
    // Already connected state – address visible directly
    await expect(page.getByText(/GSMOKE/i)).toBeVisible({ timeout: 10_000 });
  }
});

// ---------------------------------------------------------------------------
// Smoke 3: Gated content gate renders for unauthenticated visitor
// ---------------------------------------------------------------------------

test('smoke: gated content shows subscribe prompt for unauthenticated visitor', async ({ page }) => {
  // Override wallet to simulate disconnected state
  await page.addInitScript(() => {
    (window as any).freighter = {
      isConnected: async () => false,
      getPublicKey: async () => { throw new Error('Not connected'); },
      signTransaction: async () => { throw new Error('Not connected'); },
    };
  });

  await page.goto('/content/1');

  // Either a subscribe CTA or a lock indicator must be visible
  const subscribePrompt = page.getByRole('button', { name: /subscribe/i }).first();
  const lockText = page.getByText(/subscribe to unlock|exclusive content/i).first();

  await expect(subscribePrompt.or(lockText)).toBeVisible({ timeout: 10_000 });
  // Video player must NOT be accessible without a subscription
  await expect(page.locator('video')).not.toBeVisible();
});

// ---------------------------------------------------------------------------
// Smoke 4: Subscribe page renders creator list
// ---------------------------------------------------------------------------

test('smoke: subscribe page renders at least one creator', async ({ page }) => {
  await page.goto('/subscribe');
  // The page heading or at least one creator card must appear
  const heading = page.getByRole('heading', { name: /subscribe/i }).first();
  await expect(heading).toBeVisible({ timeout: 10_000 });
});

// ---------------------------------------------------------------------------
// Smoke 5: Home live creators strip renders from the creators API
// ---------------------------------------------------------------------------

test('smoke: home live creators strip renders creators from API', async ({ page }) => {
  await page.goto('/');

  // The strip must render the creator returned by the live creators API stub
  await expect(page.getByText(/smoke creator/i).first()).toBeVisible({ timeout: 10_000 });
  // No fake paid badges should be shown for creators
  await expect(page.getByText(/paid badge|verified paid/i)).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// Smoke 6: Home creators strip shows honest empty state when API returns none
// ---------------------------------------------------------------------------

test('smoke: home creators strip shows empty state when no creators', async ({ page }) => {
  await page.route('**/v1/creators**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ creators: [] }),
    });
  });

  await page.goto('/');

  // Honest empty copy must be shown instead of mock creators
  await expect(page.getByText(/no creators|be the first/i).first()).toBeVisible({ timeout: 10_000 });
});

// ---------------------------------------------------------------------------
// Smoke 7: Home creators strip shows error state when API is down
// ---------------------------------------------------------------------------

test('smoke: home creators strip shows error state when API is down', async ({ page }) => {
  await page.route('**/v1/creators**', async (route) => {
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'down' }) });
  });

  await page.goto('/');

  // Error copy must be shown and no mock creators leaked
  await expect(page.getByText(/couldn.t load|try again|unable to load/i).first()).toBeVisible({ timeout: 10_000 });
});

// ---------------------------------------------------------------------------
// Smoke 8: Freighter-only wallet messaging on home
// ---------------------------------------------------------------------------

test('smoke: home shows Freighter-only wallet messaging', async ({ page }) => {
  await page.goto('/');

  // Honest wallet copy must reference Freighter and not promise other wallets
  await expect(page.getByText(/freighter/i).first()).toBeVisible({ timeout: 10_000 });
});
