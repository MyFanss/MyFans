import { test, expect } from '@playwright/test';

test.describe('Creator page SEO metadata', () => {
  test('renders title and description for a known creator', async ({ page }) => {
    await page.goto('/creator/jane');

    await expect(page).toHaveTitle(/Jane Doe.*MyFans/i);

    const description = page.locator('meta[name="description"]');
    await expect(description).toHaveAttribute('content', /.+/);
  });

  test('renders open graph tags', async ({ page }) => {
    await page.goto('/creator/jane');

    const ogTitle = page.locator('meta[property="og:title"]');
    const ogDescription = page.locator('meta[property="og:description"]');
    const ogUrl = page.locator('meta[property="og:url"]');
    const ogType = page.locator('meta[property="og:type"]');

    await expect(ogTitle).toHaveAttribute('content', /Jane Doe/i);
    await expect(ogDescription).toHaveAttribute('content', /.+/);
    await expect(ogUrl).toHaveAttribute('content', /\/creator\/jane/);
    await expect(ogType).toHaveAttribute('content', 'profile');
  });

  test('renders twitter card tags', async ({ page }) => {
    await page.goto('/creator/jane');

    const twitterCard = page.locator('meta[name="twitter:card"]');
    const twitterTitle = page.locator('meta[name="twitter:title"]');

    await expect(twitterCard).toHaveAttribute('content', 'summary_large_image');
    await expect(twitterTitle).toHaveAttribute('content', /Jane Doe/i);
  });

  test('renders canonical link', async ({ page }) => {
    await page.goto('/creator/jane');

    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveAttribute('href', /\/creator\/jane/);
  });

  test('returns 404 for unknown creator', async ({ page }) => {
    const response = await page.goto('/creator/does-not-exist-xyz');
    expect(response?.status()).toBe(404);
  });

  test('does not expose locked post content in metadata', async ({ page }) => {
    await page.goto('/creator/jane');

    const description = await page.locator('meta[name="description"]').getAttribute('content');
    // Metadata should describe the creator, not locked post content
    expect(description).not.toMatch(/locked|exclusive content/i);
  });
});
