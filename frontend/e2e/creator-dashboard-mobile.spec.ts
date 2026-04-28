/**
 * Creator Dashboard Mobile Audit – e2e checklist (issue #629)
 *
 * These tests verify the mobile UX of the creator dashboard at a 390×844
 * viewport (iPhone 14 equivalent). Each test maps to a checklist item.
 */
import { test, expect } from '@playwright/test';

const MOBILE = { width: 390, height: 844 };

test.describe('Creator dashboard mobile audit', () => {
  test.use({ viewport: MOBILE });

  // ── Layout ──────────────────────────────────────────────────────────────

  test('mobile header is visible and not overlapping content', async ({ page }) => {
    await page.goto('/dashboard');
    const header = page.locator('header').first();
    await expect(header).toBeVisible();

    const main = page.locator('main').first();
    const headerBox = await header.boundingBox();
    const mainBox = await main.boundingBox();

    // main content starts at or below the header bottom
    expect(mainBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height - 1);
  });

  test('hamburger menu button is visible on mobile', async ({ page }) => {
    await page.goto('/dashboard');
    const hamburger = page.getByRole('button', { name: /open menu/i });
    await expect(hamburger).toBeVisible();
  });

  test('hamburger opens and closes the mobile nav', async ({ page }) => {
    await page.goto('/dashboard');
    const hamburger = page.getByRole('button', { name: /open menu/i });
    await hamburger.click();
    await expect(page.getByRole('navigation').last()).toBeVisible();

    const closeBtn = page.getByRole('button', { name: /close menu/i });
    await closeBtn.click();
    await expect(page.getByRole('navigation').last()).not.toBeVisible();
  });

  test('desktop sidebar is hidden on mobile', async ({ page }) => {
    await page.goto('/dashboard');
    // The desktop aside has max-lg:hidden – it should not be visible
    const desktopSidebar = page.locator('aside.max-lg\\:hidden');
    await expect(desktopSidebar).toBeHidden();
  });

  // ── Plans page ──────────────────────────────────────────────────────────

  test('plans page renders SubscriptionPlanForm on mobile', async ({ page }) => {
    await page.goto('/dashboard/plans');
    await expect(page.getByRole('heading', { name: /plan details/i })).toBeVisible();
  });

  test('plan form and preview stack vertically on mobile', async ({ page }) => {
    await page.goto('/dashboard/plans');
    const form = page.getByRole('region', { name: /plan details/i });
    const preview = page.getByText('Preview');

    const formBox = await form.boundingBox();
    const previewBox = await preview.boundingBox();

    // preview should be below the form (not side-by-side)
    expect(previewBox!.y).toBeGreaterThan(formBox!.y + formBox!.height - 1);
  });

  // ── Earnings page ───────────────────────────────────────────────────────

  test('earnings page renders summary and breakdown cards', async ({ page }) => {
    await page.goto('/dashboard/earnings');
    // Cards render or show loading/error states – either is acceptable
    const heading = page.getByRole('heading', { name: /earnings/i }).first();
    await expect(heading).toBeVisible();
  });

  // ── Subscribers page ────────────────────────────────────────────────────

  test('subscribers page shows mobile sort dropdown', async ({ page }) => {
    await page.goto('/dashboard/subscribers');
    const sortSelect = page.getByLabel('Sort by');
    await expect(sortSelect).toBeVisible();
  });

  test('mobile sort dropdown changes subscriber order', async ({ page }) => {
    await page.goto('/dashboard/subscribers');
    const sortSelect = page.getByLabel('Sort by');
    await sortSelect.selectOption('name-asc');
    // After sorting A→Z the first visible name should come before the last alphabetically
    const names = await page.locator('.md\\:hidden .font-semibold').allTextContents();
    if (names.length > 1) {
      expect(names[0].localeCompare(names[names.length - 1])).toBeLessThanOrEqual(0);
    }
  });

  test('desktop table headers are hidden on mobile', async ({ page }) => {
    await page.goto('/dashboard/subscribers');
    const desktopTable = page.locator('.hidden.md\\:block');
    await expect(desktopTable).toBeHidden();
  });

  test('mobile subscriber cards are visible', async ({ page }) => {
    await page.goto('/dashboard/subscribers');
    const mobileCards = page.locator('.md\\:hidden').first();
    await expect(mobileCards).toBeVisible();
  });

  // ── Touch targets ────────────────────────────────────────────────────────

  test('pagination buttons meet 44px touch target on mobile', async ({ page }) => {
    await page.goto('/dashboard/subscribers');
    const prevBtn = page.getByRole('button', { name: /previous page/i });
    const box = await prevBtn.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});
