import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/csrf', () => ({
  getCsrfToken: vi.fn().mockResolvedValue('csrf-token'),
  invalidateCsrfToken: vi.fn(),
}));

vi.mock('@/lib/api-utils', () => ({
  getAuthHeaders: () => ({ 'Content-Type': 'application/json' }),
}));

import { claimReferralCode } from '../referral';

describe('claimReferralCode', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('POSTs the code and subscriber address, returns ok on 201', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 201, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await claimReferralCode('ALICE123', 'GFAN');

    expect(result).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/referral/redeem');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      code: 'ALICE123',
      subscriberAddress: 'GFAN',
    });
  });

  it('treats an already-claimed 409 as success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({}) }),
    );

    await expect(claimReferralCode('ALICE123', 'GFAN')).resolves.toEqual({ ok: true });
  });

  it('surfaces the server reason on rejection', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ message: 'You cannot redeem your own referral code' }),
      }),
    );

    const result = await claimReferralCode('SELF1234', 'GFAN');
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/your own referral code/i);
  });

  it('fails soft on a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    const result = await claimReferralCode('ALICE123', 'GFAN');
    expect(result.ok).toBe(false);
  });
});
