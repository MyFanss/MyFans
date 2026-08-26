import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addFavorite, removeFavorite, getFavorites } from './favorites';

global.fetch = vi.fn() as any;

function mockFetchOk(body: unknown, status = 200) {
  (fetch as any).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getFavorites', () => {
  it('fetches favorites with credentials included', async () => {
    mockFetchOk(['creator-1', 'creator-2']);

    await getFavorites();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/favorites'),
      expect.objectContaining({
        credentials: 'include',
        method: undefined,
      }),
    );
  });

  it('throws Unauthorized on 401 response', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    await expect(getFavorites()).rejects.toThrow('Unauthorized');
  });
});

describe('addFavorite', () => {
  it('includes x-csrf-token header', async () => {
    // Mock CSRF token first
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ csrfToken: 'test-token' }),
    });

    // Then mock the add favorite response
    mockFetchOk(undefined, 204);

    await addFavorite('creator-1');

    // Check that CSRF was fetched
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/csrf/token'),
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
      }),
    );

    // Check that favorite was added with CSRF token
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/favorites/creator-1'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-csrf-token': 'test-token',
        }),
      }),
    );
  });

  it('throws Unauthorized on 401 response', async () => {
    // Mock CSRF token first
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ csrfToken: 'test-token' }),
    });

    // Mock unauthorized response
    (fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    await expect(addFavorite('creator-1')).rejects.toThrow('Unauthorized');
  });
});

describe('removeFavorite', () => {
  it('includes x-csrf-token header', async () => {
    // Mock CSRF token first
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ csrfToken: 'test-token' }),
    });

    // Then mock the remove favorite response
    mockFetchOk(undefined, 204);

    await removeFavorite('creator-1');

    // Check that CSRF was fetched
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/csrf/token'),
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
      }),
    );

    // Check that favorite was removed with CSRF token
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/favorites/creator-1'),
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({
          'x-csrf-token': 'test-token',
        }),
      }),
    );
  });

  it('throws Unauthorized on 401 response', async () => {
    // Mock CSRF token first
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ csrfToken: 'test-token' }),
    });

    // Mock unauthorized response
    (fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    await expect(removeFavorite('creator-1')).rejects.toThrow('Unauthorized');
  });
});
