import { test as base } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    // Mock Stellar/Soroban RPC responses
    await page.route('**/soroban-testnet.stellar.org/**', async (route) => {
      const url = route.request().url();
      
      if (url.includes('getContractData')) {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            result: { value: true }, // is_subscriber returns true
          }),
        });
      } else if (url.includes('submitTransaction')) {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            hash: 'mock_tx_hash_' + Date.now(),
            status: 'SUCCESS',
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Mock backend API
    await page.route('**/localhost:3001/api/**', async (route) => {
      const url = route.request().url();
      
      if (url.includes('/subscriptions/checkout')) {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            id: 'checkout_123',
            status: 'pending',
            amount: '10',
            fee: '0.5',
            total: '10.5',
          }),
        });
      } else if (url.includes('/subscriptions/confirm')) {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            success: true,
            txHash: 'mock_tx_hash',
          }),
        });
      } else {
        await route.continue();
      }
    });

    await use(page);
  },
});

export { expect } from '@playwright/test';
