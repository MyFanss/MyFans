import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET, POST } from '@/app/api/transactions/route';
import { NextRequest } from 'next/server';

describe('/api/transactions route', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('proxies GET to backend and maps response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          {
            id: '1',
            creator: 'GC',
            fan: 'GF',
            amount: '10',
            fee: '0.1',
            asset: 'XLM',
            txHash: 'hash',
            paidAt: '2026-03-01T00:00:00.000Z',
          },
        ],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      }),
    }) as unknown as typeof fetch;

    const request = new NextRequest('http://localhost:3000/api/transactions?page=1&limit=10', {
      headers: { Authorization: 'Bearer test-token' },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].amount).toBe(10);
    expect(body.data[0].type).toBe('payment');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/v1/analytics/payments'),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      }),
    );
  });

  it('surfaces upstream errors without 404 from missing route', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Unauthorized' }),
    }) as unknown as typeof fetch;

    const request = new NextRequest('http://localhost:3000/api/transactions');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.message).toBe('Unauthorized');
    expect(body.data).toEqual([]);
  });

  it('forwards type and status filters to the backend on GET', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [], total: 0, page: 1, limit: 10, totalPages: 1 }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const request = new NextRequest(
      'http://localhost:3000/api/transactions?type=subscription&status=pending&creator=GC',
    );
    await GET(request);

    const calledUrl = String(fetchMock.mock.calls[0][0]);
    expect(calledUrl).toMatch(/type=subscription/);
    expect(calledUrl).toMatch(/status=pending/);
    expect(calledUrl).toMatch(/creator=GC/);
  });

  it('supports POST body filters for legacy clients', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [], total: 0, page: 2, limit: 10, totalPages: 1 }),
    }) as unknown as typeof fetch;

    const request = new NextRequest('http://localhost:3000/api/transactions', {
      method: 'POST',
      body: JSON.stringify({
        page: 2,
        limit: 10,
        filters: { fromDate: '2026-01-01', toDate: '2026-02-01' },
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/from=2026-01-01/),
      expect.any(Object),
    );
  });
});
