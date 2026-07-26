import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getCsrfToken, invalidateCsrfToken } from './csrf';

global.fetch = vi.fn() as any;

const TOKEN = 'abc123def456';

function mockFetchOk(token = TOKEN) {
  (fetch as any).mockResolvedValueOnce({
    ok: true,
    json: vi.fn().mockResolvedValue({ csrfToken: token }),
  });
}

describe('getCsrfToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    invalidateCsrfToken(); // reset cache between tests
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('fetches token from versioned /csrf/token with credentials:include', async () => {
    mockFetchOk();

    const token = await getCsrfToken();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/(?:api\/)?v1\/csrf\/token$/),
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    );
    expect(token).toBe(TOKEN);
  });

  it('uses NEXT_PUBLIC_API_URL when set', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.example.com');
    // Re-import after env stub so module-level helpers see the value.
    // getVersionedApiBaseUrl reads process.env at call time, so this is enough.
    mockFetchOk();

    await getCsrfToken();

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/v1/csrf/token',
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    );
  });

  it('falls back to same-origin /api/v1 when NEXT_PUBLIC_API_URL is unset', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', '');
    mockFetchOk();

    await getCsrfToken();

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/csrf/token',
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    );
  });

  it('caches the token so fetch is only called once', async () => {
    mockFetchOk();

    await getCsrfToken();
    await getCsrfToken();

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('re-fetches after invalidateCsrfToken()', async () => {
    mockFetchOk('token-1');
    await getCsrfToken();

    invalidateCsrfToken();

    mockFetchOk('token-2');
    const second = await getCsrfToken();

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(second).toBe('token-2');
  });

  it('throws when the fetch response is not ok', async () => {
    (fetch as any).mockResolvedValueOnce({ ok: false, status: 500 });

    await expect(getCsrfToken()).rejects.toThrow('CSRF token fetch failed: 500');
  });
});
