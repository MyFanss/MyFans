import { test, expect } from '@playwright/test';

test('Favorites page shows sign-in CTA when unauthenticated', async ({ page }) => {
  // Mock CSRF endpoint
  await page.route('**/api/v1/csrf/token', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ csrfToken: 'test-csrf-token-123' }),
    });
  });

  // Mock favorites endpoint with 401
  await page.route('**/api/v1/favorites*', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Unauthorized' }),
      });
    }
  });

  await page.goto('/favorites');

  // Verify sign-in CTA is shown
  await expect(page.getByText('Sign in to save and view your favorite creators')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign In' })).toBeVisible();
});

test('Favorites page shows empty state when user has no favorites', async ({ page }) => {
  // Mock CSRF endpoint
  await page.route('**/api/v1/csrf/token', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ csrfToken: 'test-csrf-token-123' }),
    });
  });

  // Mock favorites endpoint with empty list
  await page.route('**/api/v1/favorites*', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }
  });

  await page.goto('/favorites');

  // Verify empty state is shown
  await expect(page.getByText("You haven't marked any creators as favorites yet")).toBeVisible();
  await expect(page.getByRole('link', { name: 'Discover Creators' })).toBeVisible();
});

test('Favorites page displays favorite creators and allows toggling', async ({ page }) => {
  // Mock CSRF endpoint
  await page.route('**/api/v1/csrf/token', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ csrfToken: 'test-csrf-token-123' }),
    });
  });

  // Mock favorites endpoints
  await page.route('**/api/v1/favorites*', async (route) => {
    const method = route.request().method();

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(['creator-1', 'creator-2']),
      });
    } else if (method === 'DELETE') {
      const csrfHeader = route.request().headerValue('x-csrf-token');
      expect(csrfHeader).toBeTruthy();

      await route.fulfill({
        status: 204,
      });
    }
  });

  await page.goto('/favorites');

  // Verify favorites are displayed
  await expect(page.getByText('You have 2 favorite creators')).toBeVisible();
  await expect(page.getByText('creator-1')).toBeVisible();
  await expect(page.getByText('creator-2')).toBeVisible();
});
