import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchActiveSubscriptions,
  fetchPaymentHistory,
  fetchSubscriptionHistory,
  SubscriptionsUnauthorizedError,
} from './subscriptions';

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

describe('fetchSubscriptionHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('requests the cancelled slice of the list endpoint', async () => {
    mockFetchOk({ data: [] });

    await fetchSubscriptionHistory();

    expect(fetch).toHaveBeenCalledWith(
      'https://api.test/api/v1/subscriptions/me/list?status=cancelled',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('normalizes ended-subscription items with safe defaults', async () => {
    mockFetchOk({
      data: [
        {
          id: 'hist-1',
          creator: 'Studio Art',
          plan_name: 'Basic',
          price: '4.99',
          currency: 'USD',
          startedAt: '2026-01-01T00:00:00.000Z',
          endedAt: '2026-02-01T00:00:00.000Z',
          cancelReason: 'Cancelled by user',
        },
      ],
    });

    const result = await fetchSubscriptionHistory();

    expect(result).toEqual([
      {
        id: 'hist-1',
        creatorName: 'Studio Art',
        creatorUsername: '',
        planName: 'Basic',
        price: 4.99,
        currency: 'USD',
        startedAt: '2026-01-01T00:00:00.000Z',
        endedAt: '2026-02-01T00:00:00.000Z',
        cancelReason: 'Cancelled by user',
      },
    ]);
  });

  it('throws SubscriptionsUnauthorizedError on a 401', async () => {
    localStorage.setItem('authToken', 'stale');
    mockFetchStatus(401);

    await expect(fetchSubscriptionHistory()).rejects.toThrow(SubscriptionsUnauthorizedError);
    expect(localStorage.getItem('authToken')).toBeNull();
  });
});

describe('fetchPaymentHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('hits the analytics payments endpoint', async () => {
    mockFetchOk({ data: [] });

    await fetchPaymentHistory();

    expect(fetch).toHaveBeenCalledWith(
      'https://api.test/api/v1/analytics/payments',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('normalizes payment records and falls back to a valid status', async () => {
    mockFetchOk([
      {
        id: 'pay-1',
        paidAt: '2026-02-15T00:00:00.000Z',
        creator: 'Jane Doe',
        planName: 'Pro',
        amount: 9.99,
        asset: 'XLM',
        status: 'not-a-real-status',
      },
    ]);

    const result = await fetchPaymentHistory();

    expect(result).toEqual([
      {
        id: 'pay-1',
        date: '2026-02-15T00:00:00.000Z',
        creatorName: 'Jane Doe',
        planName: 'Pro',
        amount: 9.99,
        currency: 'XLM',
        status: 'completed',
        description: undefined,
      },
    ]);
  });
});
