import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { apiClient, useApiClient, getCurrentUserOrThrow } from './api-client';
import type { AppError, GetCurrentUserResponse } from '@/types';

// Mock fetch
global.fetch = vi.fn() as any;

// Mock CSRF module so tests don't hit the network for a token
vi.mock('@/lib/csrf', () => ({
  getCsrfToken: vi.fn().mockResolvedValue('test-csrf-token'),
  invalidateCsrfToken: vi.fn(),
}));

import { getCsrfToken, invalidateCsrfToken } from '@/lib/csrf';

const mockApiUrl = 'http://localhost:3000/api';
const mockUser = { id: '1', username: 'test', followers: 0, following: 0, isVerified: false, createdAt: '2024' };

describe('ApiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_API_URL = mockApiUrl;
    localStorage.clear();
  });

  it('makes GET request with auth', async () => {
    const mockResponse = { success: true, data: mockUser };
    (fetch as any).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockResponse),
    });

    localStorage.setItem('authToken', 'test-token');
    const result = await apiClient.getCurrentUser();

    expect(fetch).toHaveBeenCalledWith(
      `${mockApiUrl}/users/me`,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        }),
      })
    );
    expect(result).toEqual(mockResponse);
  });

  it('retries on network error', async () => {
    const mockError = new TypeError('Network error');
    (fetch as any).mockRejectedValueOnce(mockError).mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true, data: mockUser }),
    });

    const result = await apiClient.getCurrentUser();

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(true);
  });

  it('does not retry non-recoverable errors', async () => {
    const mockError = { code: 'FORBIDDEN' as any, recoverable: false } as AppError;
    (fetch as any).mockRejectedValue(mockError);

    await expect(apiClient.getCurrentUser()).rejects.toEqual(mockError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('throws AppError on API error', async () => {
    (fetch as any).mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: vi.fn(),
    });

    await expect(apiClient.getCurrentUser()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('useApiClient hook returns singleton', () => {
    const { result: result1 } = renderHook(() => useApiClient());
    const { result: result2 } = renderHook(() => useApiClient());
    
    expect(result1.current).toBe(result2.current);
  });

  it('getCurrentUserOrThrow throws on failure', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: false, error: 'Not found' }),
    });

    await expect(getCurrentUserOrThrow()).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('attaches x-csrf-token header on POST requests', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true, data: mockUser }),
    });

    await apiClient.createUser({ stellarAddress: 'GABC', username: 'u' } as any);

    expect(getCsrfToken).toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-csrf-token': 'test-csrf-token' }),
      }),
    );
  });

  it('does NOT attach x-csrf-token on GET requests', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true, data: mockUser }),
    });

    await apiClient.getCurrentUser();

    const [, config] = (fetch as any).mock.calls[0];
    expect(config.headers['x-csrf-token']).toBeUndefined();
  });

  it('calls invalidateCsrfToken on 403 response', async () => {
    (fetch as any).mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: vi.fn(),
    });

    await expect(
      apiClient.createUser({ stellarAddress: 'GABC', username: 'u' } as any),
    ).rejects.toBeDefined();

    expect(invalidateCsrfToken).toHaveBeenCalled();
  });
});
