import { test, expect } from '@playwright/test';

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const hasOverflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > window.innerWidth + 1;
  });

  expect(hasOverflow).toBe(false);
}

test.describe('creator dashboard responsive behavior', () => {
  test('overview cards stack on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
    await expect(page.getByRole('button', { name: /open menu/i })).toBeVisible();

    const totalSubscribersCard = page.getByText('Total Subscribers').first();
    const activePlansCard = page.getByText('Active Plans').first();

    const firstBox = await totalSubscribersCard.boundingBox();
    const secondBox = await activePlansCard.boundingBox();

    expect(firstBox).not.toBeNull();
    expect(secondBox).not.toBeNull();

    expect((secondBox?.y ?? 0) - (firstBox?.y ?? 0)).toBeGreaterThan(20);
    await expectNoHorizontalOverflow(page);
  });

  test('overview cards use two columns on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 834, height: 1112 });
    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
    await expect(page.getByRole('button', { name: /open menu/i })).toBeVisible();

    const totalSubscribersCard = page.getByText('Total Subscribers').first();
    const activePlansCard = page.getByText('Active Plans').first();

    const firstBox = await totalSubscribersCard.boundingBox();
    const secondBox = await activePlansCard.boundingBox();

    expect(firstBox).not.toBeNull();
    expect(secondBox).not.toBeNull();

    expect(Math.abs((secondBox?.y ?? 0) - (firstBox?.y ?? 0))).toBeLessThan(6);
    await expectNoHorizontalOverflow(page);
  });

  test('overview summary renders live API data without prod mocks', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });

    let summaryRequested = false;
    await page.route('**/api/creator/dashboard/summary**', async (route) => {
      summaryRequested = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          totalSubscribers: 42,
          activePlans: 3,
          monthlyRevenue: 4200,
        }),
      });
    });

    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
    expect(summaryRequested).toBe(true);

    await expect(page.getByText('42').first()).toBeVisible();
    await expect(page.getByText('3').first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('overview shows empty state when creator has zero subscribers', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });

    await page.route('**/api/creator/dashboard/summary**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          totalSubscribers: 0,
          activePlans: 0,
          monthlyRevenue: 0,
        }),
      });
    });

    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
    await expect(page.getByText(/no subscribers yet/i).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('overview surfaces an error state when the summary API returns 500', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });

    await page.route('**/api/creator/dashboard/summary**', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
    await expect(page.getByRole('alert').first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('subscribers page shows cards on tablet and table on desktop', async ({ page }) => {
    const mobileCards = page.getByTestId('subscribers-mobile-cards-wrap').first();
    const desktopTable = page.getByTestId('subscribers-desktop-table-wrap').first();

    await page.setViewportSize({ width: 834, height: 1112 });
    await page.goto('/dashboard/subscribers');

    await expect(page.getByRole('heading', { name: 'Subscribers' })).toBeVisible();
    await expect(mobileCards).toBeVisible();
    await expect(desktopTable).toBeHidden();

    await expectNoHorizontalOverflow(page);

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/dashboard/subscribers');

    await expect(desktopTable).toBeVisible();
    await expect(mobileCards).toBeHidden();
    await expect(page.getByRole('columnheader', { name: /total paid/i })).toBeVisible();
  });
});
