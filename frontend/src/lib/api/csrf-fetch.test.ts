import { describe, it, expect, vi, beforeEach } from 'vitest';
import { csrfFetch } from './csrf-fetch';
import * as csrfModule from '@/lib/csrf';

global.fetch = vi.fn();

vi.mock('@/lib/csrf');

describe('csrfFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds CSRF token to POST requests', async () => {
    vi.mocked(csrfModule.getCsrfToken).mockResolvedValue('test-csrf-token-123');
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );

    await csrfFetch('https://api.example.com/endpoint', {
      method: 'POST',
      body: JSON.stringify({ data: 'test' }),
    });

    expect(csrfModule.getCsrfToken).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/endpoint',
      expect.objectContaining({
        method: 'POST',
        headers: expect.any(Headers),
      })
    );

    const callArgs = vi.mocked(global.fetch).mock.calls[0];
    const headers = callArgs[1]?.headers as Headers;
    expect(headers.get('X-CSRF-Token')).toBe('test-csrf-token-123');
  });

  it('adds CSRF token to DELETE requests', async () => {
    vi.mocked(csrfModule.getCsrfToken).mockResolvedValue('csrf-del-456');
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ deleted: true }), { status: 200 })
    );

    await csrfFetch('https://api.example.com/resource', {
      method: 'DELETE',
    });

    expect(csrfModule.getCsrfToken).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/resource',
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('does not add CSRF token to GET requests', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: 'value' }), { status: 200 })
    );

    await csrfFetch('https://api.example.com/data', {
      method: 'GET',
    });

    expect(csrfModule.getCsrfToken).not.toHaveBeenCalled();
  });

  it('invalidates token on 403 response', async () => {
    vi.mocked(csrfModule.getCsrfToken).mockResolvedValue('stale-token');
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 })
    );

    await expect(
      csrfFetch('https://api.example.com/protected', {
        method: 'POST',
      })
    ).rejects.toThrow(/csrf.*failed/i);

    expect(csrfModule.invalidateCsrfToken).toHaveBeenCalled();
  });

  it('throws error if CSRF token fetch fails', async () => {
    vi.mocked(csrfModule.getCsrfToken).mockRejectedValue(
      new Error('Token fetch failed')
    );

    await expect(
      csrfFetch('https://api.example.com/endpoint', {
        method: 'POST',
      })
    ).rejects.toThrow(/csrf token/i);

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
