import { test, expect } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

const slowApi = (route: Route) =>
  new Promise<void>((r) => setTimeout(() => { route.continue(); r(); }, 2000));

test.describe('skeleton loading states', () => {
  test('content page shows skeleton before content loads', async ({ page }: { page: Page }) => {
    await page.route('**/api/**', slowApi);
    await page.goto('/content/content-1', { waitUntil: 'commit' });
    await expect(page.locator('.skeleton-shimmer').first()).toBeVisible({ timeout: 3000 });
  });

  test('creator profile page shows skeleton before content loads', async ({ page }: { page: Page }) => {
    await page.route('**/api/**', slowApi);
    await page.goto('/creator/alexrivera', { waitUntil: 'commit' });
    await expect(page.locator('.skeleton-shimmer').first()).toBeVisible({ timeout: 3000 });
  });

  test('dashboard shows skeleton before content loads', async ({ page }: { page: Page }) => {
    await page.route('**/api/**', slowApi);
    await page.goto('/dashboard', { waitUntil: 'commit' });
    await expect(page.locator('.skeleton-shimmer').first()).toBeVisible({ timeout: 3000 });
  });
});
