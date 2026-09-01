import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { apiClient, useApiClient, getCurrentUserOrThrow } from './api-client';
import {
  isApiSuccess,
  isApiError,
  parseApiErrorEnvelope,
  unwrapApiResponse,
} from '@/types/api';
import type { AppError, ApiResponse, ApiErrorResponse } from '@/types';

// Mock fetch
global.fetch = vi.fn() as ReturnType<typeof vi.fn>;

// Mock CSRF module so tests don't hit the network for a token
vi.mock('@/lib/csrf', () => ({
  getCsrfToken: vi.fn().mockResolvedValue('test-csrf-token'),
  invalidateCsrfToken: vi.fn(),
}));

import { getCsrfToken, invalidateCsrfToken } from '@/lib/csrf';

const mockApiUrl = 'http://localhost:3000/api';
const mockUser = {
  id: '1',
  username: 'test',
  followers: 0,
  following: 0,
  isVerified: false,
  createdAt: '2024',
};

function mockOk(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue(body),
  };
}

function mockErr(status: number, body?: unknown) {
  return {
    ok: false,
    status,
    statusText: String(status),
    json: vi.fn().mockResolvedValue(body ?? null),
  };
}

describe('ApiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_API_URL = mockApiUrl;
    localStorage.clear();
  });

  // ── Core request ──────────────────────────────────────────────────────────

  it('makes GET request with auth headers', async () => {
    const mockResponse = { success: true, data: mockUser };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockOk(mockResponse));

    localStorage.setItem('authToken', 'test-token');
    const result = await apiClient.getCurrentUser();

    // API_BASE is resolved at module init from NEXT_PUBLIC_API_URL or the default
    // (localhost:3001). We just verify the path suffix and headers are correct.
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/users/me'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        }),
      }),
    );
    expect(result).toEqual(mockResponse);
  });

  it('retries on network error', async () => {
    const networkError = new TypeError('Network error');
    (fetch as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce(mockOk({ success: true, data: mockUser }));

    const result = await apiClient.getCurrentUser();

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(true);
  });

  it('does not retry non-recoverable errors', async () => {
    // Mock fetch so the HTTP layer returns a non-recoverable 403
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockErr(403));

    await expect(apiClient.getCurrentUser()).rejects.toMatchObject({
      code: 'FORBIDDEN',
      recoverable: false,
    });
    // With a non-recoverable error, retryWithBackoff must not retry
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  // ── Status-code → AppError mapping ──────────────────────────────────────

  it('throws AppError with code UNAUTHORIZED on 401', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockErr(401));

    await expect(apiClient.getCurrentUser()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('throws AppError with code FORBIDDEN on 403', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockErr(403));

    await expect(apiClient.createUser({ username: 'x', email: 'x@y.com', password: 'p' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('throws AppError with code NOT_FOUND on 404', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockErr(404, { statusCode: 404, message: 'Not found' }));

    await expect(apiClient.getUser('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('throws AppError with code RATE_LIMITED on 429', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockErr(429, { statusCode: 429, message: 'Too many requests' }));

    await expect(apiClient.getCurrentUser()).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    });
  });

  // ── correlationId propagation ────────────────────────────────────────────

  it('extracts correlationId from backend error envelope', async () => {
    const errorBody = {
      statusCode: 500,
      message: 'Internal server error',
      correlationId: 'corr-abc-123',
    };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockErr(500, errorBody));

    let caught: AppError | undefined;
    try {
      await apiClient.getCurrentUser();
    } catch (err: unknown) {
      caught = err as AppError;
    }

    expect(caught).toBeDefined();
    expect(caught?.context?.correlationId).toBe('corr-abc-123');
  });

  it('handles missing correlationId gracefully (production mode)', async () => {
    // Production: backend omits correlationId
    const errorBody = { statusCode: 500, message: 'Internal server error' };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockErr(500, errorBody));

    let caught: AppError | undefined;
    try {
      await apiClient.getCurrentUser();
    } catch (err: unknown) {
      caught = err as AppError;
    }

    expect(caught?.context?.correlationId).toBeUndefined();
  });

  // ── CSRF ──────────────────────────────────────────────────────────────────

  it('attaches x-csrf-token header on POST requests', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockOk({ success: true, data: mockUser }),
    );

    await apiClient.createUser({ username: 'u', email: 'u@example.com', password: 'p' });

    expect(getCsrfToken).toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-csrf-token': 'test-csrf-token' }),
      }),
    );
  });

  it('does NOT attach x-csrf-token on GET requests', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockOk({ success: true, data: mockUser }),
    );

    await apiClient.getCurrentUser();

    const [, config] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(config.headers['x-csrf-token']).toBeUndefined();
  });

  it('calls invalidateCsrfToken on 403 response', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockErr(403));

    await expect(
      apiClient.createUser({ username: 'u', email: 'u@example.com', password: 'p' }),
    ).rejects.toBeDefined();

    expect(invalidateCsrfToken).toHaveBeenCalled();
  });

  // ── Bare DTO ↔ wrapped envelope ──────────────────────────────────────────

  it('wraps bare DTO response from getCurrentUser', async () => {
    const bareUser = { ...mockUser, email: 'test@example.com' };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockOk(bareUser));

    const result = await apiClient.getCurrentUser();

    expect(result).toEqual({ success: true, data: bareUser });
    expect(result.success).toBe(true);
  });

  it('preserves wrapped ApiSuccessResponse from getCurrentUser', async () => {
    const wrapped = { success: true, data: mockUser };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockOk(wrapped));

    const result = await apiClient.getCurrentUser();

    expect(result).toEqual(wrapped);
    expect(result.success).toBe(true);
  });

  // ── useApiClient hook ────────────────────────────────────────────────────

  it('useApiClient hook returns singleton', () => {
    const { result: r1 } = renderHook(() => useApiClient());
    const { result: r2 } = renderHook(() => useApiClient());
    expect(r1.current).toBe(r2.current);
  });

  // ── getCurrentUserOrThrow ────────────────────────────────────────────────

  it('getCurrentUserOrThrow returns user on success', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockOk({ success: true, data: mockUser }),
    );

    const user = await getCurrentUserOrThrow();
    expect(user).toEqual(mockUser);
  });

  it('getCurrentUserOrThrow throws AppError with NOT_FOUND on failure', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockOk({ success: false, statusCode: 404, message: 'Not found' }),
    );

    await expect(getCurrentUserOrThrow()).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('getCurrentUserOrThrow propagates correlationId from error envelope', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockOk({
        success: false,
        statusCode: 500,
        message: 'Internal error',
        correlationId: 'corr-xyz-789',
      }),
    );

    let caught: AppError | undefined;
    try {
      await getCurrentUserOrThrow();
    } catch (err: unknown) {
      caught = err as AppError;
    }

    expect(caught?.context?.correlationId).toBe('corr-xyz-789');
  });
});

// ── parseApiErrorEnvelope unit tests ─────────────────────────────────────────

describe('parseApiErrorEnvelope', () => {
  it('parses a backend CorrelationExceptionFilter body', () => {
    const raw = { statusCode: 401, message: 'Unauthorized', correlationId: 'corr-1' };
    const result = parseApiErrorEnvelope(raw);

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(401);
    expect(result.message).toBe('Unauthorized');
    expect(result.correlationId).toBe('corr-1');
  });

  it('falls back gracefully for unrecognised object shape', () => {
    const raw = { something: 'weird' };
    const result = parseApiErrorEnvelope(raw);

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(0);
    expect(result.message).toBe('Unknown error');
  });

  it('handles plain Error', () => {
    const result = parseApiErrorEnvelope(new Error('oops'));
    expect(result.success).toBe(false);
    expect(result.message).toBe('oops');
  });

  it('handles string thrown', () => {
    const result = parseApiErrorEnvelope('something blew up');
    expect(result.success).toBe(false);
    expect(result.message).toBe('something blew up');
  });

  it('handles null', () => {
    const result = parseApiErrorEnvelope(null);
    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(0);
  });
});

// ── isApiSuccess / isApiError type-guard tests ─────────────────────────────

describe('ApiResponse type guards', () => {
  it('isApiSuccess returns true for success envelope', () => {
    const r: ApiResponse<string> = { success: true, data: 'hello' };
    expect(isApiSuccess(r)).toBe(true);
    expect(isApiError(r)).toBe(false);
  });

  it('isApiError returns true for error envelope', () => {
    const r: ApiResponse<string> = {
      success: false,
      statusCode: 404,
      message: 'Not found',
    };
    expect(isApiError(r)).toBe(true);
    expect(isApiSuccess(r)).toBe(false);
  });
});

// ── unwrapApiResponse tests ──────────────────────────────────────────────────

describe('unwrapApiResponse', () => {
  it('returns data on success', () => {
    const r: ApiResponse<number> = { success: true, data: 42 };
    expect(unwrapApiResponse(r)).toBe(42);
  });

  it('throws ApiErrorResponse on failure', () => {
    const r: ApiResponse<number> = {
      success: false,
      statusCode: 403,
      message: 'Forbidden',
      correlationId: 'corr-err',
    };
    expect(() => unwrapApiResponse(r)).toThrow();
    let caught: ApiErrorResponse | undefined;
    try {
      unwrapApiResponse(r);
    } catch (e: unknown) {
      caught = e as ApiErrorResponse;
    }
    expect(caught?.correlationId).toBe('corr-err');
    expect(caught?.statusCode).toBe(403);
  });
});
