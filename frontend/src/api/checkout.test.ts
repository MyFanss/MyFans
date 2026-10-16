import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchCheckoutHistory,
  hasSignedTxHash,
  type CheckoutHistoryEntry,
} from './checkout';
import { apiFetch } from './client';

vi.mock('./client', () => ({ apiFetch: vi.fn() }));

const mockApiFetch = apiFetch as unknown as ReturnType<typeof vi.fn>;

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
    mockApiFetch.mockReset();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns the array directly when the API responds with a bare array', async () => {
    const entries = [{ id: '1', txHash: '0xabc' }];
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: async () => entries,
    });

    await expect(fetchCheckoutHistory()).resolves.toEqual(entries);
  });

  it('returns data.entries for the envelope shape', async () => {
    const entries = [{ id: '2', txHash: '0xdef' }];
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ entries }),
    });

    await expect(fetchCheckoutHistory()).resolves.toEqual(entries);
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

  it('returns [] when entries is missing from the envelope', async () => {
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    await expect(fetchCheckoutHistory()).resolves.toEqual([]);
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
});

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

    await expect(fetchCheckoutHistory()).resolves.toEqual([]);
  });

  it('rejects with a message containing the HTTP status when res.ok is false', async () => {
    mockApiFetch.mockResolvedValue({
      ok: false,
      status: 500,
    });

    await expect(fetchCheckoutHistory()).rejects.toThrow(/500/);
  });
});

describe('hasSignedTxHash', () => {
  it('is false for undefined, null, and whitespace-only txHash', () => {
    expect(hasSignedTxHash({ txHash: undefined })).toBe(false);
    expect(hasSignedTxHash({ txHash: null })).toBe(false);
    expect(hasSignedTxHash({ txHash: '   ' })).toBe(false);
  });

  it('is true for a non-empty hash', () => {
    expect(hasSignedTxHash({ txHash: '0x1234' })).toBe(true);
  });
});
  });
});
