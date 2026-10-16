import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteAccount, fetchProfile, updateProfile } from './users-api';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('users-api', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('fetchProfile', () => {
    it('GETs the profile path with the auth header', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'u1', email: 'a@b.co' }));

      const profile = await fetchProfile('token-123');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe(`${API_BASE}/users/me`);
      expect(init?.method ?? 'GET').toBe('GET');
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer token-123' });
      expect(profile).toMatchObject({ id: 'u1', email: 'a@b.co' });
    });

    it('surfaces a non-ok response as an error', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ message: 'unauthorized' }, { status: 401 }),
      );

      await expect(fetchProfile('bad-token')).rejects.toThrow();
    });
  });

  describe('updateProfile', () => {
    it('PATCHes the profile path with the auth header and body', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'u1', name: 'New Name' }));

      const payload = { name: 'New Name' };
      const updated = await updateProfile('token-123', payload);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe(`${API_BASE}/users/me`);
      expect(init?.method).toBe('PATCH');
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer token-123' });
      expect(JSON.parse(String(init?.body))).toEqual(payload);
      expect(updated).toMatchObject({ id: 'u1', name: 'New Name' });
    });

    it('surfaces a non-ok response as an error', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ message: 'invalid' }, { status: 422 }),
      );

      await expect(updateProfile('token-123', { name: '' })).rejects.toThrow();
    });
  });

  describe('deleteAccount', () => {
    it('DELETEs the account path with the auth header', async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

      await deleteAccount('token-123');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe(`${API_BASE}/users/me`);
      expect(init?.method).toBe('DELETE');
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer token-123' });
    });

    it('surfaces a non-ok response as an error', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ message: 'forbidden' }, { status: 403 }),
      );

      await expect(deleteAccount('token-123')).rejects.toThrow();
    });
  });
});
