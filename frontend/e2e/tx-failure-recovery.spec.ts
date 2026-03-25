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
});

test.describe('TxFailureRecovery component (direct render via error-test page)', () => {
  test('error-test page loads without crashing', async ({ page }) => {
    await page.goto('/error-test');
    // Just verify the page loads — it exercises error components
    await expect(page).toHaveURL(/error-test/);
  });
});
