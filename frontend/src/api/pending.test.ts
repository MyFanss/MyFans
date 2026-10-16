import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PENDING_STUCK_TIMEOUT_MS,
  fetchPendingItems,
  isPendingApiAvailable,
} from './pending';

describe('isPendingApiAvailable', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns false in production when VITE_PENDING_API_URL is unset', () => {
    vi.stubEnv('MODE', 'production');
    vi.stubEnv('VITE_PENDING_API_URL', '');

    expect(isPendingApiAvailable()).toBe(false);
  });

  it('returns true outside production', () => {
    vi.stubEnv('MODE', 'development');
    vi.stubEnv('VITE_PENDING_API_URL', '');

    expect(isPendingApiAvailable()).toBe(true);
  });
});

describe('fetchPendingItems', () => {
  beforeEach(() => {
    vi.stubEnv('MODE', 'development');
    vi.stubEnv('VITE_PENDING_API_URL', 'https://example.test/pending');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('resolves to [] in production when the API is unavailable', async () => {
    vi.stubEnv('MODE', 'production');
    vi.stubEnv('VITE_PENDING_API_URL', '');

    await expect(fetchPendingItems()).resolves.toEqual([]);
  });

  it('normalizes a raw record without txHash to txHash: undefined', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => [
          {
            id: 'pending-1',
            status: 'pending',
            createdAt: new Date().toISOString(),
          },
        ],
      })),
    );

    const items = await fetchPendingItems();

    expect(items).toHaveLength(1);
    expect(items[0].txHash).toBeUndefined();
  });

  it('marks records older than the stuck timeout as stuck', async () => {
    vi.useFakeTimers();
    const now = new Date('2024-01-01T00:00:00.000Z');
    vi.setSystemTime(now);

    const stale = new Date(now.getTime() - PENDING_STUCK_TIMEOUT_MS - 1000).toISOString();

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => [
          {
            id: 'pending-2',
            status: 'pending',
            createdAt: stale,
          },
        ],
      })),
    );

    const items = await fetchPendingItems();

    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('stuck');
    expect(items[0].isStuck).toBe(true);
  });

  it('rejects when the response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 503,
        json: async () => ({}),
      })),
    );

    await expect(fetchPendingItems()).rejects.toThrow(/503/);
  });
});
