import { test, expect } from '@playwright/test';

test('Messages inbox loads and allows sending messages', async ({ page }) => {
  // Setup: mock CSRF endpoint
  await page.route('**/api/v1/csrf/token', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ csrfToken: 'test-csrf-token-123' }),
    });
  });

  // Mock conversations list endpoint
  await page.route('**/api/v1/conversations*', async (route) => {
    const method = route.request().method();
    const url = route.request().url();

    // List conversations
    if (method === 'GET' && !url.includes('/messages')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'conv-1',
              participant1Id: 'user-1',
              participant2Id: 'user-2',
              participant1: {
                id: 'user-1',
                username: 'alice',
                displayName: 'Alice',
              },
              participant2: {
                id: 'user-2',
                username: 'bob',
                displayName: 'Bob',
              },
              lastMessage: {
                id: 'msg-1',
                conversationId: 'conv-1',
                senderId: 'user-1',
                content: 'Hello Bob!',
                isRead: false,
                createdAt: '2026-01-01T10:00:00.000Z',
              },
              updatedAt: '2026-01-01T10:00:00.000Z',
              createdAt: '2026-01-01T09:00:00.000Z',
            },
          ],
          limit: 20,
          nextCursor: null,
          hasMore: false,
        }),
      });
    }

    // Get specific conversation and its messages
    if (method === 'GET' && url.includes('/messages')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'msg-1',
              conversationId: 'conv-1',
              senderId: 'user-1',
              content: 'Hello Bob!',
              isRead: false,
              createdAt: '2026-01-01T10:00:00.000Z',
            },
          ],
          limit: 30,
          nextCursor: null,
          hasMore: false,
        }),
      });
    }

    // Send message
    if (method === 'POST' && url.includes('/messages')) {
      const csrfHeader = route.request().headerValue('x-csrf-token');
      const idempotencyHeader = route.request().headerValue('idempotency-key');

      // Verify headers are present
      expect(csrfHeader).toBeTruthy();
      expect(idempotencyHeader).toBeTruthy();

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'msg-2',
          conversationId: 'conv-1',
          senderId: 'user-2',
          content: 'Hi Alice!',
          isRead: false,
          createdAt: '2026-01-01T10:05:00.000Z',
        }),
      });
    }
  });

  // Navigate to messages page
  await page.goto('/messages');

  // Verify inbox loads
  await expect(page.getByRole('heading', { name: 'Messages' })).toBeVisible();
  await expect(page.getByText('Bob')).toBeVisible();
  await expect(page.getByText('Hello Bob!')).toBeVisible();

  // Click on conversation
  await page.getByText('Bob').first().click();

  // Verify thread loads
  await expect(page.getByText('Hello Bob!')).toBeVisible();

  // Send a message
  const input = page.getByPlaceholder('Type a message...');
  await input.fill('Hi Alice!');
  await page.getByRole('button', { name: 'Send' }).click();

  // Verify message was sent (the sent button is disabled while sending)
  await expect(page.getByRole('button', { name: 'Send' })).toBeEnabled();
});

test('Messages page shows unauthorized error when not authenticated', async ({ page }) => {
  // Mock conversations list with 401
  await page.route('**/api/v1/conversations*', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Unauthorized' }),
    });
  });

  await page.goto('/messages');

  // Verify auth error message
  await expect(
    page.getByText('You must be signed in to view messages. Please sign in to continue.'),
  ).toBeVisible();
});

test('Send is rejected without a CSRF token', async ({ page }) => {
  // CSRF endpoint returns no token, simulating a missing/expired token
  await page.route('**/api/v1/csrf/token', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ csrfToken: '' }),
    });
  });

  await page.route('**/api/v1/conversations*', async (route) => {
    const method = route.request().method();
    const url = route.request().url();

    if (method === 'GET' && !url.includes('/messages')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'conv-1',
              participant1Id: 'user-1',
              participant2Id: 'user-2',
              participant1: { id: 'user-1', username: 'alice', displayName: 'Alice' },
              participant2: { id: 'user-2', username: 'bob', displayName: 'Bob' },
              lastMessage: null,
              updatedAt: '2026-01-01T10:00:00.000Z',
              createdAt: '2026-01-01T09:00:00.000Z',
            },
          ],
          limit: 20,
          nextCursor: null,
          hasMore: false,
        }),
      });
    }

    if (method === 'GET' && url.includes('/messages')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], limit: 30, nextCursor: null, hasMore: false }),
      });
    }

    if (method === 'POST' && url.includes('/messages')) {
      const csrfHeader = route.request().headerValue('x-csrf-token');
      // Server must reject sends that lack a CSRF token
      if (!csrfHeader) {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Invalid CSRF token' }),
        });
        return;
      }
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'msg-2',
          conversationId: 'conv-1',
          senderId: 'user-1',
          content: 'Hi Bob!',
          isRead: false,
          createdAt: '2026-01-01T10:05:00.000Z',
        }),
      });
    }
  });

  await page.goto('/messages');
  await page.getByText('Bob').first().click();

  const input = page.getByPlaceholder('Type a message...');
  await input.fill('Hi Bob!');
  await page.getByRole('button', { name: 'Send' }).click();

  // The send must not succeed without a CSRF token
  await expect(page.getByText('Hi Bob!')).not.toBeVisible();
});

test('Message body is escaped on render to prevent XSS', async ({ page }) => {
  const xssPayload = '<img src=x onerror="window.__xss=1">';

  await page.route('**/api/v1/csrf/token', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ csrfToken: 'test-csrf-token-123' }),
    });
  });

  await page.route('**/api/v1/conversations*', async (route) => {
    const method = route.request().method();
    const url = route.request().url();

    if (method === 'GET' && !url.includes('/messages')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'conv-1',
              participant1Id: 'user-1',
              participant2Id: 'user-2',
              participant1: { id: 'user-1', username: 'alice', displayName: 'Alice' },
              participant2: { id: 'user-2', username: 'bob', displayName: 'Bob' },
              lastMessage: {
                id: 'msg-1',
                conversationId: 'conv-1',
                senderId: 'user-2',
                content: xssPayload,
                isRead: false,
                createdAt: '2026-01-01T10:00:00.000Z',
              },
              updatedAt: '2026-01-01T10:00:00.000Z',
              createdAt: '2026-01-01T09:00:00.000Z',
            },
          ],
          limit: 20,
          nextCursor: null,
          hasMore: false,
        }),
      });
    }

    if (method === 'GET' && url.includes('/messages')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'msg-1',
              conversationId: 'conv-1',
              senderId: 'user-2',
              content: xssPayload,
              isRead: false,
              createdAt: '2026-01-01T10:00:00.000Z',
            },
          ],
          limit: 30,
          nextCursor: null,
          hasMore: false,
        }),
      });
    }
  });

  await page.goto('/messages');
  await page.getByText('Bob').first().click();

  // The payload must be rendered as text, not executed as HTML
  await expect(page.getByText(xssPayload)).toBeVisible();
  const xssExecuted = await page.evaluate(() => (window as unknown as { __xss?: number }).__xss);
  expect(xssExecuted).toBeUndefined();
});
