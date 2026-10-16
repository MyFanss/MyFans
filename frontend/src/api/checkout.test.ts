import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchCheckoutHistory, hasSignedTxHash } from './checkout';
import { apiFetch } from './client';

vi.mock('./client', () => ({ apiFetch: vi.fn() }));

const mockApiFetch = apiFetch as unknown as ReturnType<typeof vi.fn>;

describe('fetchCheckoutHistory', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
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

  it('returns [] when entries is missing from the envelope', async () => {
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
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
