import { test, expect } from '@playwright/test';

/**
 * SEO metadata tests for creator profile pages.
 * Verifies dynamic title, description, and Open Graph tags are rendered correctly,
 * and that private/locked content metadata is never exposed.
 */

test.describe('Creator page SEO metadata', () => {
  test('renders dynamic title with creator name', async ({ page }) => {
    await page.goto('/creator/jane');
    const title = await page.title();
    expect(title).toContain('Jane Doe');
    expect(title).toContain('@jane');
    expect(title).toContain('MyFans');
  });

  test('renders meta description with creator bio', async ({ page }) => {
    await page.goto('/creator/jane');
    const description = await page
      .locator('meta[name="description"]')
      .getAttribute('content');
    expect(description).toBeTruthy();
    expect(description!.length).toBeGreaterThan(10);
  });

  test('renders Open Graph title tag', async ({ page }) => {
    await page.goto('/creator/jane');
    const ogTitle = await page
      .locator('meta[property="og:title"]')
      .getAttribute('content');
    expect(ogTitle).toContain('Jane Doe');
  });

  test('renders Open Graph description tag', async ({ page }) => {
    await page.goto('/creator/jane');
    const ogDesc = await page
      .locator('meta[property="og:description"]')
      .getAttribute('content');
    expect(ogDesc).toBeTruthy();
    expect(ogDesc!.length).toBeGreaterThan(10);
  });

  test('renders og:type as profile for creator pages', async ({ page }) => {
    await page.goto('/creator/jane');
    const ogType = await page
      .locator('meta[property="og:type"]')
      .getAttribute('content');
    expect(ogType).toBe('profile');
  });

  test('renders canonical URL for creator page', async ({ page }) => {
    await page.goto('/creator/jane');
    const canonical = await page
      .locator('link[rel="canonical"]')
      .getAttribute('href');
    expect(canonical).toContain('/creator/jane');
  });

  test('renders Twitter card tags', async ({ page }) => {
    await page.goto('/creator/jane');
    const twitterCard = await page
      .locator('meta[name="twitter:card"]')
      .getAttribute('content');
    expect(twitterCard).toBe('summary_large_image');

    const twitterTitle = await page
      .locator('meta[name="twitter:title"]')
      .getAttribute('content');
    expect(twitterTitle).toContain('Jane Doe');
  });

  test('returns noindex for unknown creator', async ({ page }) => {
    await page.goto('/creator/nonexistent-user-xyz');
    const robots = await page
      .locator('meta[name="robots"]')
      .getAttribute('content');
    // Should either 404 or have noindex
    const statusCode = page.url();
    if (!statusCode.includes('404')) {
      expect(robots).toMatch(/noindex/i);
    }
  });

  test('does not expose private/locked content in metadata', async ({ page }) => {
    await page.goto('/creator/jane');
    const html = await page.content();

    // Extract all meta tag content values
    const metaTags = await page.locator('meta').all();
    const metaContents = await Promise.all(
      metaTags.map((tag) => tag.getAttribute('content'))
    );
    const allMetaText = metaContents.filter(Boolean).join(' ').toLowerCase();

    // Locked content titles/excerpts should not appear in metadata
    expect(allMetaText).not.toContain('private');
    expect(allMetaText).not.toContain('locked');
    expect(allMetaText).not.toContain('password');
    expect(allMetaText).not.toContain('secret');
    expect(allMetaText).not.toContain('token');
  });

  test('metadata is present in initial HTML (SSR)', async ({ page }) => {
    // Disable JS to verify metadata is server-rendered, not client-injected
    await page.context().setExtraHTTPHeaders({});
    const response = await page.goto('/creator/jane', {
      waitUntil: 'commit', // get raw HTML before JS runs
    });
    const body = await response!.text();

    expect(body).toContain('<title>');
    expect(body).toContain('og:title');
    expect(body).toContain('og:description');
  });

  test('different creators get different metadata', async ({ page }) => {
    await page.goto('/creator/jane');
    const janeTitle = await page.title();

    await page.goto('/creator/alex');
    const alexTitle = await page.title();

    expect(janeTitle).not.toBe(alexTitle);
  });
});
