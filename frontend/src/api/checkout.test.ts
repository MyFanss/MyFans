import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchCheckoutHistory,
  hasSignedTxHash,
  type CheckoutHistoryEntry,
} from './checkout';

function makeEntry(overrides: Partial<CheckoutHistoryEntry> = {}): CheckoutHistoryEntry {
  return {
    id: 'chk_1',
    createdAt: '2024-01-01T00:00:00.000Z',
    status: 'completed',
    amount: '10.00',
    currency: 'USD',
    ...overrides,
  };
}

describe('hasSignedTxHash', () => {
  it('returns true for a real signed transaction hash', () => {
    expect(hasSignedTxHash(makeEntry({ txHash: 'abc123def456' }))).toBe(true);
  });

  it('returns false when txHash is missing, null, empty, or whitespace', () => {
    expect(hasSignedTxHash(makeEntry())).toBe(false);
    expect(hasSignedTxHash(makeEntry({ txHash: null }))).toBe(false);
    expect(hasSignedTxHash(makeEntry({ txHash: '' }))).toBe(false);
    expect(hasSignedTxHash(makeEntry({ txHash: '   ' }))).toBe(false);
  });
});

describe('fetchCheckoutHistory', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('normalizes a well-formed { entries } payload', async () => {
    const entries = [makeEntry({ txHash: 'signed-hash' }), makeEntry({ id: 'chk_2', txHash: null })];
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ entries }),
    }) as unknown as typeof fetch;

    await expect(fetchCheckoutHistory()).resolves.toEqual(entries);
  });

  it('normalizes a bare array payload', async () => {
    const entries = [makeEntry()];
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => entries,
    }) as unknown as typeof fetch;

    await expect(fetchCheckoutHistory()).resolves.toEqual(entries);
  });

  it('returns an empty array for a malformed payload without entries', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    }) as unknown as typeof fetch;

    await expect(fetchCheckoutHistory()).resolves.toEqual([]);
  });

  it('throws when the response is not ok', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    }) as unknown as typeof fetch;

    await expect(fetchCheckoutHistory()).rejects.toThrow('Failed to load checkout history (500)');
  });
});
