import { test, expect } from '@playwright/test';

test('Games list loads with proper error handling', async ({ page }) => {
  // Setup: mock CSRF endpoint
  await page.route('**/api/v1/csrf/token', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ csrfToken: 'test-csrf-token-123' }),
    });
  });

  // Mock games list endpoint
  await page.route('**/api/v1/games*', async (route) => {
    const method = route.request().method();
    const url = route.request().url();

    if (method === 'GET' && !url.includes('/start') && !url.includes('/join')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'game-1',
              title: 'Chess Tournament',
              description: 'A competitive chess game',
              imageUrl: 'https://example.com/chess.jpg',
              status: 'PENDING',
              maxPlayers: 4,
              currentPlayers: 1,
              hostUserId: 'user-1',
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
          limit: 20,
          nextCursor: null,
          hasMore: false,
        }),
      });
    }

    // Get specific game
    if (method === 'GET' && url.includes('/games/game-1') && !url.includes('/join')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'game-1',
          title: 'Chess Tournament',
          description: 'A competitive chess game',
          imageUrl: 'https://example.com/chess.jpg',
          status: 'PENDING',
          maxPlayers: 4,
          currentPlayers: 2,
          hostUserId: 'user-1',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        }),
      });
    }

    // Join game
    if (method === 'POST' && url.includes('/join')) {
      const csrfHeader = route.request().headerValue('x-csrf-token');
      expect(csrfHeader).toBeTruthy();

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Successfully joined the game' }),
      });
    }

    // Start game
    if (method === 'POST' && url.includes('/start')) {
      const csrfHeader = route.request().headerValue('x-csrf-token');
      const idempotencyHeader = route.request().headerValue('idempotency-key');

      expect(csrfHeader).toBeTruthy();
      expect(idempotencyHeader).toBeTruthy();

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'game-1',
          title: 'Chess Tournament',
          description: 'A competitive chess game',
          imageUrl: 'https://example.com/chess.jpg',
          status: 'ACTIVE',
          maxPlayers: 4,
          currentPlayers: 2,
          hostUserId: 'user-1',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        }),
      });
    }
  });

  // Navigate to games page
  await page.goto('/games');

  // Verify games list loads
  await expect(page.getByRole('heading', { name: 'Games' })).toBeVisible();
  await expect(page.getByText('Chess Tournament')).toBeVisible();
  await expect(page.getByText(/1\/4 players/)).toBeVisible();

  // Click on game to see detail
  await page.getByText('Chess Tournament').first().click();

  // Verify game detail loads
  await expect(page.getByRole('heading', { name: 'Chess Tournament' })).toBeVisible();
  await expect(page.getByText('2/4')).toBeVisible(); // updated player count
  await expect(page.getByRole('button', { name: 'Join Game' })).toBeVisible();
});

test('Games page shows unauthorized error when not authenticated', async ({ page }) => {
  // Mock games list with 401
  await page.route('**/api/v1/games*', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Unauthorized' }),
    });
  });

  await page.goto('/games');

  // Verify auth error message
  await expect(
    page.getByText('You must be signed in to view games. Please sign in to continue.'),
  ).toBeVisible();
});

test('Games page shows server error message', async ({ page }) => {
  // Mock games list with 500
  await page.route('**/api/v1/games*', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Internal server error' }),
    });
  });

  await page.goto('/games');

  // Verify server error message
  await expect(
    page.getByText('We encountered an issue loading games. Please try again later.'),
  ).toBeVisible();
});
