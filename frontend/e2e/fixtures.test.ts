import { describe, it, expect, vi } from 'vitest';
import type { Page } from '@playwright/test';
import {
  generateMockTxHash,
  generateMockSubscriptionId,
  generateMockCheckoutId,
  setupApiMocks,
} from './fixtures';

type RouteHandler = (route: any) => Promise<void>;

function captureHandler(): { page: Page; getHandler: () => RouteHandler } {
  let handler: RouteHandler | undefined;
  const page = {
    route: vi.fn(async (_pattern: string, h: RouteHandler) => {
      handler = h;
    }),
  } as unknown as Page;
  return {
    page,
    getHandler: () => {
      if (!handler) throw new Error('route handler was not registered');
      return handler;
    },
  };
}

function makeRoute(url: string, method: string) {
  const fulfill = vi.fn(async () => {});
  const route = {
    request: () => ({ url: () => url, method: () => method }),
    fulfill,
    continue: vi.fn(async () => {}),
  };
  return { route, fulfill };
}

describe('mock generators', () => {
  it('generateMockTxHash returns unique prefixed strings', () => {
    const a = generateMockTxHash();
    const b = generateMockTxHash();
    expect(a).not.toBe(b);
    expect(a.startsWith('mock_tx_hash_')).toBe(true);
    expect(b.startsWith('mock_tx_hash_')).toBe(true);
  });

  it('generateMockSubscriptionId returns unique prefixed strings', () => {
    const a = generateMockSubscriptionId();
    const b = generateMockSubscriptionId();
    expect(a).not.toBe(b);
    expect(a.startsWith('sub_')).toBe(true);
    expect(b.startsWith('sub_')).toBe(true);
  });

  it('generateMockCheckoutId returns unique prefixed strings', () => {
    const a = generateMockCheckoutId();
    const b = generateMockCheckoutId();
    expect(a).not.toBe(b);
    expect(a.startsWith('checkout_')).toBe(true);
    expect(b.startsWith('checkout_')).toBe(true);
  });
});

describe('setupApiMocks route handler', () => {
  it('fulfils failed checkout with 400 and JSON error body', async () => {
    const { page, getHandler } = captureHandler();
    await setupApiMocks(page, { shouldFailCheckout: true });
    const { route, fulfill } = makeRoute('http://localhost:3001/subscriptions/checkout', 'POST');
    await getHandler()(route);
    expect(fulfill).toHaveBeenCalledTimes(1);
    const arg = fulfill.mock.calls[0][0] as { status: number; body: string };
    expect(arg.status).toBe(400);
    const body = JSON.parse(arg.body);
    expect(body).toHaveProperty('error');
  });

  it('fulfils failed confirm with 400', async () => {
    const { page, getHandler } = captureHandler();
    await setupApiMocks(page, { shouldFailConfirm: true });
    const { route, fulfill } = makeRoute('http://localhost:3001/subscriptions/confirm', 'POST');
    await getHandler()(route);
    expect(fulfill).toHaveBeenCalledTimes(1);
    const arg = fulfill.mock.calls[0][0] as { status: number; body: string };
    expect(arg.status).toBe(400);
    const body = JSON.parse(arg.body);
    expect(body).toHaveProperty('error');
  });

  it('fulfils status error with 500', async () => {
    const { page, getHandler } = captureHandler();
    await setupApiMocks(page, { subscriptionStatus: 'error' });
    const { route, fulfill } = makeRoute('http://localhost:3001/subscriptions/status', 'GET');
    await getHandler()(route);
    expect(fulfill).toHaveBeenCalledTimes(1);
    const arg = fulfill.mock.calls[0][0] as { status: number; body: string };
    expect(arg.status).toBe(500);
    const body = JSON.parse(arg.body);
    expect(body).toHaveProperty('error');
  });

  it('default status response has isSubscribed false', async () => {
    const { page, getHandler } = captureHandler();
    await setupApiMocks(page);
    const { route, fulfill } = makeRoute('http://localhost:3001/subscriptions/status', 'GET');
    await getHandler()(route);
    expect(fulfill).toHaveBeenCalledTimes(1);
    const arg = fulfill.mock.calls[0][0] as { status: number; body: string };
    expect(arg.status).toBe(200);
    const body = JSON.parse(arg.body);
    expect(body.isSubscribed).toBe(false);
  });
});
