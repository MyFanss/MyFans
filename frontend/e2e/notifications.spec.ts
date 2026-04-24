import { test, expect } from '@playwright/test';

test.describe('Notification Inbox', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/notifications');
  });

  test('renders the notifications page with heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /notifications/i })).toBeVisible();
  });

  test('shows All and Unread filter tabs', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /all/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /unread/i })).toBeVisible();
  });

  test('displays notification list items', async ({ page }) => {
    const list = page.getByRole('list', { name: /notification list/i });
    await expect(list).toBeVisible({ timeout: 8000 });
    const items = list.getByRole('button');
    await expect(items.first()).toBeVisible();
  });

  test('unread filter shows only unread notifications', async ({ page }) => {
    await page.getByRole('tab', { name: /unread/i }).click();
    // After switching to unread, either items show or empty state
    const list = page.getByRole('list', { name: /notification list/i });
    const empty = page.getByText(/no unread notifications/i);
    await expect(list.or(empty)).toBeVisible({ timeout: 5000 });
  });

  test('clicking a notification opens detail modal', async ({ page }) => {
    const list = page.getByRole('list', { name: /notification list/i });
    await expect(list).toBeVisible({ timeout: 8000 });
    await list.getByRole('button').first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('detail modal can be closed', async ({ page }) => {
    const list = page.getByRole('list', { name: /notification list/i });
    await expect(list).toBeVisible({ timeout: 8000 });
    await list.getByRole('button').first().click();
    await page.getByRole('dialog').getByLabel('Close').click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('mark all as read button is visible when unread exist', async ({ page }) => {
    // With mock data there are unread notifications
    const btn = page.getByRole('button', { name: /mark all as read/i });
    await expect(btn).toBeVisible({ timeout: 5000 });
  });

  test('mark all as read removes unread badges', async ({ page }) => {
    await page.getByRole('button', { name: /mark all as read/i }).click();
    // After marking all read, the button should disappear
    await expect(page.getByRole('button', { name: /mark all as read/i })).not.toBeVisible({ timeout: 3000 });
  });

  test('notification item has accessible label', async ({ page }) => {
    const list = page.getByRole('list', { name: /notification list/i });
    await expect(list).toBeVisible({ timeout: 8000 });
    const firstItem = list.getByRole('button').first();
    await expect(firstItem).toHaveAttribute('aria-label');
  });

  // ── Digest display ────────────────────────────────────────────────────────

  test('digest notification shows a count badge', async ({ page }) => {
    const list = page.getByRole('list', { name: /notification list/i });
    await expect(list).toBeVisible({ timeout: 8000 });

    // Mock data includes a digest with digest_count=3 ("3 subscriptions renewed")
    const digestBadge = list.getByLabel(/events batched/i).first();
    await expect(digestBadge).toBeVisible({ timeout: 5000 });
  });

  test('digest notification detail shows batched events summary', async ({ page }) => {
    const list = page.getByRole('list', { name: /notification list/i });
    await expect(list).toBeVisible({ timeout: 8000 });

    // Click the item whose title contains a number (digest)
    const digestItem = list.getByRole('button', { name: /subscriptions renewed/i }).first();
    await expect(digestItem).toBeVisible({ timeout: 5000 });
    await digestItem.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId('digest-summary')).toBeVisible();
    await expect(dialog.getByText(/events batched/i)).toBeVisible();
  });
});
