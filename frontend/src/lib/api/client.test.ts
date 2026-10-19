import { afterEach, describe, expect, it, vi } from 'vitest';

describe('apiFetch', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  /**
   * Return the mock fetch arguments for the n-th call (1-indexed).
   * Returns [url, init].
   */
  function callArgs(n: number): [string, RequestInit] {
    return mockFetch.mock.calls[n - 1] as [string, RequestInit];
  }

  function headersOf(n: number): Headers {
    return new Headers(callArgs(n)[1].headers);
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  /**
   * Dynamically import apiFetch so each test gets a fresh module-level
   * _csrfToken cache.
   */
  async function importApiFetch(): Promise<
    typeof import('./client').apiFetch
  > {
    const mod = await import('./client');
    return mod.apiFetch;
  }

  it('GET does not fetch a CSRF token and sends no x-csrf-token header', async () => {
    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal('fetch', mockFetch);

    const apiFetch = await importApiFetch();
    await apiFetch('/public/data', { method: 'GET' });

    // Only one fetch call (no CSRF token fetch)
    expect(mockFetch).toHaveBeenCalledTimes(1);
    // The x-csrf-token header must not be present
    expect(headersOf(1).has('x-csrf-token')).toBe(false);
  });

  it('POST attaches x-csrf-token from the CSRF endpoint', async () => {
    let callIdx = 0;
    mockFetch = vi.fn().mockImplementation((url: string) => {
      callIdx++;
      if (url === '/api/v1/csrf/token') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ csrfToken: 's3cr3t-t0k3n' }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
    vi.stubGlobal('fetch', mockFetch);

    const apiFetch = await importApiFetch();
    await apiFetch('/plans', { method: 'POST' });

    // CSRF token fetched first, then the actual request
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(callArgs(1)[0]).toBe('/api/v1/csrf/token');
    expect(callArgs(2)[0]).toBe('/plans');
    expect(callArgs(2)[1].method).toBe('POST');
    // The second call must carry the CSRF token
    expect(headersOf(2).get('x-csrf-token')).toBe('s3cr3t-t0k3n');
  });

  it('retries exactly once on a 403 with a freshly fetched token', async () => {
    let callIdx = 0;
    mockFetch = vi.fn().mockImplementation((url: string) => {
      callIdx++;

      if (url === '/api/v1/csrf/token') {
        // Return a token that includes the call index so we can distinguish
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ csrfToken: `tkn-${callIdx}` }),
        });
      }

      // The first attempt at the real endpoint returns 403, the second succeeds
      const isFirstAttempt = callIdx === 2;
      return Promise.resolve({
        ok: !isFirstAttempt,
        status: isFirstAttempt ? 403 : 200,
        json: () => Promise.resolve({}),
      });
    });
    vi.stubGlobal('fetch', mockFetch);

    const apiFetch = await importApiFetch();
    const res = await apiFetch('/orders', { method: 'PATCH' });

    // Expected sequence:
    //   1. GET /api/v1/csrf/token          (cached token = tkn-1)
    //   2. PATCH /orders  → 403            (invalidates cache)
    //   3. GET /api/v1/csrf/token          (cached token = tkn-3)
    //   4. PATCH /orders  → 200
    expect(mockFetch).toHaveBeenCalledTimes(4);

    // 1 – CSRF fetch
    expect(callArgs(1)[0]).toBe('/api/v1/csrf/token');
    // 2 – initial request, should carry tkn-1
    expect(callArgs(2)[0]).toBe('/orders');
    expect(callArgs(2)[1].method).toBe('PATCH');
    expect(headersOf(2).get('x-csrf-token')).toBe('tkn-1');
    // 3 – CSRF re-fetch after invalidation
    expect(callArgs(3)[0]).toBe('/api/v1/csrf/token');
    // 4 – retry, should carry the new token tkn-3
    expect(callArgs(4)[0]).toBe('/orders');
    expect(callArgs(4)[1].method).toBe('PATCH');
    expect(headersOf(4).get('x-csrf-token')).toBe('tkn-3');

    // Tokens must be different (proving the cache was invalidated)
    expect(headersOf(2).get('x-csrf-token')).not.toBe(
      headersOf(4).get('x-csrf-token'),
    );

    // Final response status is 200 (from the retry)
    expect(res.status).toBe(200);
  });

  it('forwards idempotencyKey as the idempotency-key header', async () => {
    mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/v1/csrf/token') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ csrfToken: 'tok' }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
    vi.stubGlobal('fetch', mockFetch);

    const apiFetch = await importApiFetch();
    await apiFetch('/checkout', {
      method: 'POST',
      idempotencyKey: 'my-unique-key',
    });

    // The actual POST request (second call) should have the header
    expect(callArgs(2)[1].method).toBe('POST');
    expect(headersOf(2).get('idempotency-key')).toBe('my-unique-key');
  });

  it('prepends /api/v1/ to paths without a leading slash', async () => {
    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal('fetch', mockFetch);

    const apiFetch = await importApiFetch();

    // Path without leading slash → prefixed
    await apiFetch('relative-path', { method: 'GET' });
    expect(callArgs(1)[0]).toBe('/api/v1/relative-path');

    // Path with leading slash → used as-is
    await apiFetch('/absolute-path', { method: 'GET' });
    expect(callArgs(2)[0]).toBe('/absolute-path');
  });

  it('retries only once even if the retry also returns 403', async () => {
    let callIdx = 0;
    mockFetch = vi.fn().mockImplementation((url: string) => {
      callIdx++;

      if (url === '/api/v1/csrf/token') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ csrfToken: `tkn-${callIdx}` }),
        });
      }

      // Every attempt at the real endpoint returns 403
      return Promise.resolve({
        ok: false,
        status: 403,
        json: () => Promise.resolve({}),
      });
    });
    vi.stubGlobal('fetch', mockFetch);

    const apiFetch = await importApiFetch();
    const res = await apiFetch('/fragile', { method: 'DELETE' });

    // Sequence: CSRF fetch, DELETE (403), CSRF re-fetch, DELETE (403) → no third attempt
    expect(mockFetch).toHaveBeenCalledTimes(4);

    // Both DELETE calls got a 403, so the final status is still 403
    expect(res.status).toBe(403);
  });

  it('PUT and DELETE also attach the CSRF token', async () => {
    mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/v1/csrf/token') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ csrfToken: 'multi-method-token' }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
    vi.stubGlobal('fetch', mockFetch);

    const apiFetch = await importApiFetch();

    await apiFetch('/resource', { method: 'PUT' });
    expect(headersOf(2).get('x-csrf-token')).toBe('multi-method-token');

    await apiFetch('/resource', { method: 'DELETE' });
    expect(headersOf(4).get('x-csrf-token')).toBe('multi-method-token');
  });
});