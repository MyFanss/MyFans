import { test, expect } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

test.describe('content metadata optimistic updates', () => {
  const contentPage = '/content/content-1';

  test('like button updates count instantly', async ({ page }: { page: Page }) => {
    await page.goto(contentPage);

    const likeBtn = page.getByRole('button', { name: /like/i });
    await expect(likeBtn).toBeVisible();

    const before = await likeBtn.textContent();
    await likeBtn.click();

    const after = await likeBtn.textContent();
    expect(after).not.toBe(before);
  });

  test('rolls back and shows error banner on API failure', async ({ page }: { page: Page }) => {
    await page.route('**/api/content/*/like', (route: Route) => route.abort());

    await page.goto(contentPage);

    const likeBtn = page.getByRole('button', { name: /like/i });
    const before = await likeBtn.textContent();

    await likeBtn.click();

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 5000 });

    const after = await likeBtn.textContent();
    expect(after).toBe(before);
  });

  test('error banner can be dismissed', async ({ page }: { page: Page }) => {
    await page.route('**/api/content/*/like', (route: Route) => route.abort());

    await page.goto(contentPage);
    await page.getByRole('button', { name: /like/i }).click();

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: /dismiss/i }).click();
    await expect(alert).not.toBeVisible();
  });
});
