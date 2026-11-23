/**
 * #2213: fetchPlan returns null on a 404 (the canonical "plan was deleted"
 * signal usePlan relies on) and throws on any other non-OK status, so a
 * 500 is never mistaken for a deleted plan.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchPlan } from './plans';

describe('fetchPlan', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves to null when the server returns 404', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 404,
      ok: false,
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(fetchPlan('plan-1')).resolves.toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('rejects with an error that includes the status when the server returns 500', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 500,
      ok: false,
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(fetchPlan('plan-1')).rejects.toThrow('500');
  });

  it('resolves to the plan id from the body when the server returns 200', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: () =>
        Promise.resolve({
          id: 'plan-1',
          creator: 'creator-1',
          asset: 'USDC',
          amount: '9.99',
          interval: '30d',
          network: 'TESTNET',
        }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const plan = await fetchPlan('plan-1');
    expect(plan?.id).toBe('plan-1');
  });
});
