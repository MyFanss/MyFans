import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    invalidateCsrfToken(); // reset cache between tests
  });

  it('fetches token from /v1/csrf/token with credentials:include', async () => {
    mockFetchOk();

    const token = await getCsrfToken();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/v1/csrf/token'),
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    );
    expect(token).toBe(TOKEN);
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
