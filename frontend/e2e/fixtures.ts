import { test as base, Page } from '@playwright/test';

// Mock wallet addresses for testing
export const MOCK_WALLET_ADDRESS = 'GTEST1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
export const MOCK_CREATOR_ADDRESS = 'GCREATOR1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ123';

// Mock data generators
export const generateMockTxHash = () => `mock_tx_hash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
export const generateMockSubscriptionId = () => `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
export const generateMockCheckoutId = () => `checkout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Wallet mock helper
export async function setupWalletMock(page: Page, options: {
  shouldReject?: boolean;
  delay?: number;
} = {}) {
  await page.addInitScript((opts) => {
    (window as any).freighter = {
      getPublicKey: async () => {
        if (opts.delay) {
          await new Promise(resolve => setTimeout(resolve, opts.delay));
        }
        if (opts.shouldReject) {
          throw new Error('User rejected the request');
        }
        return 'GTEST1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
      },
      signTransaction: async (xdr: string) => {
        if (opts.delay) {
          await new Promise(resolve => setTimeout(resolve, opts.delay));
        }
        if (opts.shouldReject) {
          throw new Error('User rejected the transaction');
        }
        return xdr + '_signed';
      },
      isConnected: async () => !opts.shouldReject,
    };
  }, options);
}

// API mock helper
export async function setupApiMocks(page: Page, options: {
  subscriptionStatus?: 'active' | 'inactive' | 'error';
  shouldFailCheckout?: boolean;
  shouldFailConfirm?: boolean;
  delay?: number;
} = {}) {
  await page.route('**/localhost:3001/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    const delay = options.delay || 0;

    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    // Subscription checkout
    if (url.includes('/subscriptions/checkout') && method === 'POST') {
      if (options.shouldFailCheckout) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Checkout failed',
            message: 'Insufficient funds or invalid request',
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: generateMockCheckoutId(),
          status: 'pending',
          amount: '10',
          fee: '0.5',
          total: '10.5',
          creatorId: 'c1',
          planId: 'plan_basic',
        }),
      });
      return;
    }

    // Subscription confirmation
    if (url.includes('/subscriptions/confirm') && method === 'POST') {
      if (options.shouldFailConfirm) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Confirmation failed',
            message: 'Transaction verification failed',
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          subscriptionId: generateMockSubscriptionId(),
          txHash: generateMockTxHash(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      });
      return;
    }

    // Subscription status
    if (url.includes('/subscriptions/status') && method === 'GET') {
      const isActive = options.subscriptionStatus === 'active';
      
      if (options.subscriptionStatus === 'error') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Internal server error',
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          isSubscribed: isActive,
          subscriptionId: isActive ? 'sub_active' : null,
          expiresAt: isActive ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null,
        }),
      });
      return;
    }

    // Content access check
    if (url.includes('/content/') && url.includes('/access') && method === 'GET') {
      const hasAccess = options.subscriptionStatus === 'active';
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          hasAccess,
          contentUrl: hasAccess ? '/sample-video.mp4' : null,
        }),
      });
      return;
    }

    // Let other requests through
    await route.continue();
  });
}

// Stellar/Soroban RPC mock helper
export async function setupStellarMocks(page: Page, options: {
  shouldFail?: boolean;
  delay?: number;
} = {}) {
  await page.route('**/soroban-testnet.stellar.org/**', async (route) => {
    const url = route.request().url();
    const delay = options.delay || 0;

    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    if (options.shouldFail) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'RPC error',
        }),
      });
      return;
    }

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
          hash: generateMockTxHash(),
          status: 'SUCCESS',
        }),
      });
    } else {
      await route.continue();
    }
  });
}

// Extended test with fixtures
export const test = base.extend({
  page: async ({ page }, use) => {
    // Setup default mocks
    await setupWalletMock(page);
    await setupApiMocks(page, { subscriptionStatus: 'active' });
    await setupStellarMocks(page);

    await use(page);
  },
});

export { expect } from '@playwright/test';
