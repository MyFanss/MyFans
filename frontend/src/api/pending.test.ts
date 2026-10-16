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
    vi.stubEnv('MODE',

import {
  PENDING_STUCK_TIMEOUT_MS,
  fetchPendingItems,
  isPendingApiAvailable,
  type PendingItem,
} from "./pending";

describe("isPendingApiAvailable", () => {
  const originalEnv = import.meta.env;

  afterEach(() => {
    vi.unstubAllEnvs();
    import.meta.env = originalEnv;
  });

  it("returns true when VITE_PENDING_API_URL is configured", () => {
    vi.stubEnv("VITE_PENDING_API_URL", "https://api.example.com/pending");
    expect(isPendingApiAvailable()).toBe(true);
  });

  it("returns true in non-production builds without an endpoint", () => {
    vi.stubEnv("VITE_PENDING_API_URL", "");
    vi.stubEnv("MODE", "test");
    expect(isPendingApiAvailable()).toBe(true);
  });

  it("returns false in production builds without an endpoint", () => {
    vi.stubEnv("VITE_PENDING_API_URL", "");
    vi.stubEnv("MODE", "production");
    expect(isPendingApiAvailable()).toBe(false);
  });
});

describe("fetchPendingItems", () => {
  const originalEnv = import.meta.env;

  beforeEach(() => {
    vi.stubEnv("VITE_PENDING_API_URL", "https://api.example.com/pending");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    import.meta.env = originalEnv;
  });

  it("normalizes a well-formed payload", async () => {
    const payload = {
      items: [
        {
          id: "p-1",
          kind: "transaction",
          status: "confirming",
          createdAt: new Date().toISOString(),
          txHash: "0xabc123",
          label: "Checkout #1234",
        },
      ],
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => payload,
      }),
    );

    const items = await fetchPendingItems();

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject<PendingItem>({
      id: "p-1",
      kind: "transaction",
      status: "confirming",
      txHash: "0xabc123",
      label: "Checkout #1234",
      isStuck: false,
    });
  });

  it("drops malformed records instead of throwing", async () => {
    const payload = {
      items: [
        { id: "p-1", createdAt: new Date().toISOString() },
        { id: 42, createdAt: new Date().toISOString() },
        { id: "p-3" },
        null,
        "not-an-object",
      ],
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => payload,
      }),
    );

    const items = await fetchPendingItems();

    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("p-1");
    expect(items[0].txHash).toBeUndefined();
  });

  it("marks items older than the stuck timeout as stuck", async () => {
    const stale = new Date(Date.now() - PENDING_STUCK_TIMEOUT_MS - 1000).toISOString();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [{ id: "p-1", createdAt: stale }],
      }),
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

    );

    const items = await fetchPendingItems();

    expect(items).toHaveLength(1);
    expect(items[0].isStuck).toBe(true);
    expect(items[0].status).toBe("stuck");
  });

  it("returns an empty list when the endpoint is not configured in production", async () => {
    vi.stubEnv("VITE_PENDING_API_URL", "");
    vi.stubEnv("MODE", "production");

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchPendingItems()).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws when the backend responds with an error status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({}),
      }),
    );

    await expect(fetchPendingItems()).rejects.toThrow(/500/);
  });
});
