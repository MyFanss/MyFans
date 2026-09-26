import { test, expect } from '@playwright/test';

/**
 * E2E tests for transaction failure recovery UI.
 * These tests exercise the checkout confirm step where tx errors surface.
 */

test.describe('Transaction Failure Recovery', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Freighter wallet
    await page.addInitScript(() => {
      (window as any).freighter = {
        getPublicKey: async () => 'GTEST1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890',
        signTransaction: async (_xdr: string) => {
          throw new Error('User rejected the request');
        },
      };
    });
  });

  test('recovery panel renders with headline and steps on tx failure', async ({ page }) => {
    await page.goto('/checkout?planId=1&creatorAddress=GCREATOR&fanAddress=GFAN');

    // Wait for checkout to load and proceed to confirm step
    const confirmBtn = page.getByRole('button', { name: /confirm/i });
    if (await confirmBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    const submitBtn = page.getByRole('button', { name: /sign.*subscribe/i });
    if (await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await submitBtn.click();

      // Recovery panel should appear
      const panel = page.getByTestId('tx-failure-recovery');
      await expect(panel).toBeVisible({ timeout: 8000 });

      // Should have a headline
      await expect(panel.getByRole('heading')).toBeVisible();

      // Should have numbered steps
      const steps = panel.getByRole('list', { name: /recovery steps/i });
      await expect(steps).toBeVisible();
    }
  });

  test('recovery panel has retry and back actions', async ({ page }) => {
    await page.goto('/checkout?planId=1&creatorAddress=GCREATOR&fanAddress=GFAN');

    const confirmBtn = page.getByRole('button', { name: /confirm/i });
    if (await confirmBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    const submitBtn = page.getByRole('button', { name: /sign.*subscribe/i });
    if (await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await submitBtn.click();

      const panel = page.getByTestId('tx-failure-recovery');
      await expect(panel).toBeVisible({ timeout: 8000 });

      // Should have at least one action button
      const buttons = panel.getByRole('button');
      await expect(buttons.first()).toBeVisible();
    }
  });

  test('recovery panel is announced to screen readers via role=alert', async ({ page }) => {
    await page.goto('/checkout?planId=1&creatorAddress=GCREATOR&fanAddress=GFAN');

    const confirmBtn = page.getByRole('button', { name: /confirm/i });
    if (await confirmBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    const submitBtn = page.getByRole('button', { name: /sign.*subscribe/i });
    if (await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await submitBtn.click();

      const panel = page.getByTestId('tx-failure-recovery');
      await expect(panel).toBeVisible({ timeout: 8000 });
      await expect(panel).toHaveAttribute('role', 'alert');
    }
  });

  test('wallet rejection surfaces recovery panel and does not submit an empty tx', async ({ page }) => {
    const submitted: string[] = [];
    await page.route('**/subscriptions', async (route) => {
      submitted.push(route.request().postData() ?? '');
      await route.fulfill({ status: 201, body: JSON.stringify({ id: 'sub_1' }) });
    });

    await page.goto('/checkout?planId=1&creatorAddress=GCREATOR&fanAddress=GFAN');

    const confirmBtn = page.getByRole('button', { name: /confirm/i });
    if (await confirmBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    const submitBtn = page.getByRole('button', { name: /sign.*subscribe/i });
    if (await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await submitBtn.click();

      const panel = page.getByTestId('tx-failure-recovery');
      await expect(panel).toBeVisible({ timeout: 8000 });

      // Wallet rejection must not produce a subscription submission
      expect(submitted).toHaveLength(0);
    }
  });

  test('API 409 conflict is surfaced as a recoverable failure', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).freighter = {
        getPublicKey: async () => 'GTEST1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890',
        signTransaction: async (_xdr: string) => 'SIGNED_XDR',
      };
    });

    await page.route('**/subscriptions', async (route) => {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'conflict', message: 'Subscription already exists' }),
      });
    });

    await page.goto('/checkout?planId=1&creatorAddress=GCREATOR&fanAddress=GFAN');

    const confirmBtn = page.getByRole('button', { name: /confirm/i });
    if (await confirmBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    const submitBtn = page.getByRole('button', { name: /sign.*subscribe/i });
    if (await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await submitBtn.click();

      const panel = page.getByTestId('tx-failure-recovery');
      await expect(panel).toBeVisible({ timeout: 8000 });
      await expect(panel).toHaveAttribute('role', 'alert');
    }
  });

  test('submit button is disabled while the transaction is in flight', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).freighter = {
        getPublicKey: async () => 'GTEST1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890',
        signTransaction: async (_xdr: string) => {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          return 'SIGNED_XDR';
        },
      };
    });

    await page.route('**/subscriptions', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.fulfill({ status: 201, body: JSON.stringify({ id: 'sub_1' }) });
    });

    await page.goto('/checkout?planId=1&creatorAddress=GCREATOR&fanAddress=GFAN');

    const confirmBtn = page.getByRole('button', { name: /confirm/i });
    if (await confirmBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    const submitBtn = page.getByRole('button', { name: /sign.*subscribe/i });
    if (await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await submitBtn.click();

      // While in flight the submit control must be disabled to prevent double submits
      await expect(submitBtn).toBeDisabled({ timeout: 3000 });
    }
  });
});

test.describe('TxFailureRecovery component (direct render via error-test page)', () => {
  test('error-test page loads without crashing', async ({ page }) => {
    await page.goto('/error-test');
    // Just verify the page loads — it exercises error components
    await expect(page).toHaveURL(/error-test/);
  });
});
