import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchActiveSubscriptions, SubscriptionsUnauthorizedError } from './subscriptions';

vi.mock('@/lib/api/base-url', () => ({
  getApiBaseUrl: () => 'https://api.test',
}));

global.fetch = vi.fn() as unknown as typeof fetch;

function mockFetchOk(body: unknown) {
  (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue(body),
  });
}

function mockFetchStatus(status: number, body: unknown = {}) {
  (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: false,
    status,
    json: vi.fn().mockResolvedValue(body),
  });
}

describe('fetchActiveSubscriptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('hits the versioned subscriptions endpoint with the configured API base', async () => {
    mockFetchOk({ data: [] });

    await fetchActiveSubscriptions({ status: 'active', sort: 'expiry' });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.test/api/v1/subscriptions/me/list?status=active&sort=expiry',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('attaches a Bearer token from stored auth when present', async () => {
    localStorage.setItem('authToken', 'jwt-access-token');
    mockFetchOk({ data: [] });

    await fetchActiveSubscriptions({});

    const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer jwt-access-token');
  });

  it('omits the Authorization header when no token is stored', async () => {
    mockFetchOk({ data: [] });

    await fetchActiveSubscriptions({});

    const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('normalizes list items with fallback field names and safe defaults', async () => {
    mockFetchOk({
      data: [
        {
          id: 'sub-1',
          creator: 'Jane Doe',
          creator_username: 'jane',
          plan_name: 'Pro',
          price: '9.99',
          currency: 'USD',
          current_period_end: '2026-08-01T00:00:00.000Z',
        },
      ],
    });

    const result = await fetchActiveSubscriptions({});

    expect(result).toEqual([
      {
        id: 'sub-1',
        creatorId: '',
        creatorName: 'Jane Doe',
        creatorUsername: 'jane',
        planName: 'Pro',
        price: 9.99,
        currency: 'USD',
        interval: 'month',
        currentPeriodEnd: '2026-08-01T00:00:00.000Z',
        status: 'active',
      },
    ]);
  });

  it('handles a bare array response shape', async () => {
    mockFetchOk([{ id: 'sub-2' }]);

    const result = await fetchActiveSubscriptions({});

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('sub-2');
  });

  it('throws SubscriptionsUnauthorizedError and clears the token on a 401', async () => {
    localStorage.setItem('authToken', 'stale-token');
    mockFetchStatus(401);

    await expect(fetchActiveSubscriptions({})).rejects.toThrow(SubscriptionsUnauthorizedError);
    expect(localStorage.getItem('authToken')).toBeNull();
  });

  it('throws a generic error on a non-401 failure without clearing auth', async () => {
    localStorage.setItem('authToken', 'jwt-access-token');
    mockFetchStatus(500, { message: 'Internal server error' });

    await expect(fetchActiveSubscriptions({})).rejects.toThrow('Internal server error');
    expect(localStorage.getItem('authToken')).toBe('jwt-access-token');
  });
});
