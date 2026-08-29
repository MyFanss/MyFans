import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPlan, getCreatorPlans, generatePlanIdempotencyKey } from './plans';
import type { CreatePlanRequest } from './plans';

vi.mock('@/lib/csrf', () => ({
  getCsrfToken: vi.fn(() => Promise.resolve('test-csrf-token')),
  invalidateCsrfToken: vi.fn(),
}));

global.fetch = vi.fn();

describe('Plans API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createPlan', () => {
    it('creates a plan with idempotency key', async () => {
      const mockPlan = {
        id: 1,
        creator: 'GBCQ...',
        asset: 'USDC',
        amount: '100.00',
        intervalDays: 30,
      };

      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockPlan), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const request: CreatePlanRequest = {
        creator: 'GBCQ...',
        asset: 'USDC',
        amount: '100.00',
        intervalDays: 30,
      };

      const result = await createPlan(request, 'test-idempotency-key-123');

      expect(result).toEqual(mockPlan);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/creators/plans'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Idempotency-Key': 'test-idempotency-key-123',
            // #1611: cookie-authed plan create must carry the CSRF token.
            'X-CSRF-Token': 'test-csrf-token',
          }),
        })
      );
    });

    it('rejects 403 with unauthorized error', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Forbidden' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const request: CreatePlanRequest = {
        creator: 'GBCQ...',
        asset: 'USDC',
        amount: '100.00',
        intervalDays: 30,
      };

      await expect(createPlan(request, 'key')).rejects.toThrow(/permission/i);
    });

    it('rejects 400 with validation error', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Invalid interval' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const request: CreatePlanRequest = {
        creator: 'GBCQ...',
        asset: 'USDC',
        amount: '100.00',
        intervalDays: 0,
      };

      await expect(createPlan(request, 'key')).rejects.toThrow(/validation/i);
    });

    it('handles network errors', async () => {
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network failed'));

      const request: CreatePlanRequest = {
        creator: 'GBCQ...',
        asset: 'USDC',
        amount: '100.00',
        intervalDays: 30,
      };

      await expect(createPlan(request, 'key')).rejects.toThrow(/network/i);
    });
  });

  describe('getCreatorPlans', () => {
    it('fetches paginated creator plans', async () => {
      const mockResponse = {
        data: [
          {
            id: 1,
            creator: 'GBCQ...',
            asset: 'XLM',
            amount: '50.00',
            intervalDays: 30,
            syncStatus: 'synced' as const,
          },
        ],
        limit: 20,
        page: 1,
        total: 1,
        total_pages: 1,
      };

      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await getCreatorPlans('GBCQ...', 1, 20);

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/creators/GBCQ.../plans'),
        expect.objectContaining({
          method: undefined,
        })
      );
    });

    it('handles pagination parameters', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({
          data: [],
          limit: 50,
          page: 2,
          total: 100,
          total_pages: 2,
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      await getCreatorPlans('CREATOR123', 2, 50);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('page=2'),
        expect.any(Object)
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=50'),
        expect.any(Object)
      );
    });

    it('rejects 403 for unauthorized access', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Forbidden' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      await expect(getCreatorPlans('NOTMYCREATOR', 1, 20)).rejects.toThrow(/permission/i);
    });
  });

  describe('generatePlanIdempotencyKey', () => {
    it('generates stable keys for identical requests', () => {
      const request: CreatePlanRequest = {
        creator: 'GBCQ...',
        asset: 'USDC',
        amount: '100.00',
        intervalDays: 30,
      };

      const key1 = generatePlanIdempotencyKey(request);
      const key2 = generatePlanIdempotencyKey(request);

      expect(key1).toBe(key2);
      expect(key1).toMatch(/^plan-/);
    });

    it('generates different keys for different requests', () => {
      const request1: CreatePlanRequest = {
        creator: 'GBCQ...',
        asset: 'USDC',
        amount: '100.00',
        intervalDays: 30,
      };

      const request2: CreatePlanRequest = {
        creator: 'GBCQ...',
        asset: 'XLM',
        amount: '100.00',
        intervalDays: 30,
      };

      const key1 = generatePlanIdempotencyKey(request1);
      const key2 = generatePlanIdempotencyKey(request2);

      expect(key1).not.toBe(key2);
    });
  });
});
