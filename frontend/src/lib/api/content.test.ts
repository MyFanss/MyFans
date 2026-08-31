import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getContentAccess, getContentById } from './content';

const originalFetch = global.fetch;

function mockFetch(impl: (url: string) => Partial<Response> & { json?: () => Promise<unknown> }) {
  global.fetch = vi.fn((url: string) => Promise.resolve(impl(url) as Response)) as unknown as typeof fetch;
}

describe('content API client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('getContentById', () => {
    it('returns null on 404 so the caller can 404 the page', async () => {
      mockFetch(() => ({ ok: false, status: 404, json: async () => ({}) }));
      await expect(getContentById('missing')).resolves.toBeNull();
    });
  });

  describe('getContentAccess', () => {
    it('hits GET /content/:id/access with credentials', async () => {
      const fetchMock = vi.fn(() =>
        Promise.resolve({ ok: true, status: 200, json: async () => ({ hasAccess: true }) } as Response),
      );
      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await getContentAccess('abc 123');

      expect(result).toEqual({ hasAccess: true, reason: 'granted' });
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toMatch(/\/content\/abc%20123\/access$/);
      expect(init).toMatchObject({ credentials: 'include' });
    });

    it('accepts alternative truthy keys from the backend', async () => {
      mockFetch(() => ({ ok: true, status: 200, json: async () => ({ unlocked: true }) }));
      await expect(getContentAccess('1')).resolves.toEqual({ hasAccess: true, reason: 'granted' });
    });

    it('maps 401 to not_authenticated (fail closed)', async () => {
      mockFetch(() => ({ ok: false, status: 401, json: async () => ({}) }));
      await expect(getContentAccess('1')).resolves.toEqual({
        hasAccess: false,
        reason: 'not_authenticated',
      });
    });

    it('maps 404 to not_found (fail closed)', async () => {
      mockFetch(() => ({ ok: false, status: 404, json: async () => ({}) }));
      await expect(getContentAccess('1')).resolves.toEqual({
        hasAccess: false,
        reason: 'not_found',
      });
    });

    it('fails closed on a 500', async () => {
      mockFetch(() => ({ ok: false, status: 500, json: async () => ({}) }));
      await expect(getContentAccess('1')).resolves.toEqual({ hasAccess: false, reason: 'error' });
    });

    it('fails closed when fetch itself rejects', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('network down'))) as unknown as typeof fetch;
      await expect(getContentAccess('1')).resolves.toEqual({ hasAccess: false, reason: 'error' });
    });

    it('reports subscription_required when the backend denies without a reason', async () => {
      mockFetch(() => ({ ok: true, status: 200, json: async () => ({ hasAccess: false }) }));
      await expect(getContentAccess('1')).resolves.toEqual({
        hasAccess: false,
        reason: 'subscription_required',
      });
    });
  });
});
