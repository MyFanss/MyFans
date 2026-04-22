import { test, expect } from '@playwright/test';

test.describe('Notification Preferences', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
    // Navigate to the Notifications section
    await page.getByRole('button', { name: /notifications/i }).click();
  });

  test('renders the notification preferences form', async ({ page }) => {
    await expect(
      page.getByTestId('notification-preferences-form'),
    ).toBeVisible({ timeout: 8000 });
  });

  test('shows channel master switches', async ({ page }) => {
    const form = page.getByTestId('notification-preferences-form');
    await expect(form).toBeVisible({ timeout: 8000 });

    await expect(page.getByRole('switch', { name: /email notifications/i })).toBeVisible();
    await expect(page.getByRole('switch', { name: /push notifications/i })).toBeVisible();
    await expect(page.getByRole('switch', { name: /marketing emails/i })).toBeVisible();
  });

  test('shows per-event toggles for email channel', async ({ page }) => {
    const form = page.getByTestId('notification-preferences-form');
    await expect(form).toBeVisible({ timeout: 8000 });

    await expect(page.getByRole('switch', { name: /new subscriber via email/i })).toBeVisible();
    await expect(page.getByRole('switch', { name: /payout sent via email/i })).toBeVisible();
  });

  test('shows per-event toggles for push channel', async ({ page }) => {
    const form = page.getByTestId('notification-preferences-form');
    await expect(form).toBeVisible({ timeout: 8000 });

    await expect(page.getByRole('switch', { name: /new subscriber via push/i })).toBeVisible();
  });

  test('disabling email channel disables per-event email toggles', async ({ page }) => {
    const form = page.getByTestId('notification-preferences-form');
    await expect(form).toBeVisible({ timeout: 8000 });

    const emailMaster = page.getByRole('switch', { name: /email notifications/i });
    // Email is on by default — turn it off
    if ((await emailMaster.getAttribute('aria-checked')) === 'true') {
      await emailMaster.click();
    }

    // Per-event email toggles should now be disabled
    const perEventToggle = page.getByRole('switch', { name: /new subscriber via email/i });
    await expect(perEventToggle).toBeDisabled();
  });

  test('save preferences button is present', async ({ page }) => {
    const form = page.getByTestId('notification-preferences-form');
    await expect(form).toBeVisible({ timeout: 8000 });

    await expect(
      page.getByRole('button', { name: /save preferences/i }),
    ).toBeVisible();
  });

  test('clicking save shows success feedback', async ({ page }) => {
    const form = page.getByTestId('notification-preferences-form');
    await expect(form).toBeVisible({ timeout: 8000 });

    await page.getByRole('button', { name: /save preferences/i }).click();

    await expect(page.getByText(/preferences saved/i)).toBeVisible({ timeout: 5000 });
  });

  test('toggles are keyboard accessible', async ({ page }) => {
    const form = page.getByTestId('notification-preferences-form');
    await expect(form).toBeVisible({ timeout: 8000 });

    const emailMaster = page.getByRole('switch', { name: /email notifications/i });
    await emailMaster.focus();
    const before = await emailMaster.getAttribute('aria-checked');
    await page.keyboard.press('Space');
    const after = await emailMaster.getAttribute('aria-checked');
    expect(before).not.toBe(after);
  });
});
