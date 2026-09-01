import { useMemo } from 'react';
import type {
  ApiResponse,
  ApiErrorResponse,
  User,
  CreateUserRequest,
  GetCurrentUserResponse,
  Post,
  CreatePostRequest,
  GetPostsResponse,
  Subscription,
  CreateSubscriptionRequest,
  GetSubscriptionsResponse,
  PaginatedResponse,
  SubscriptionHistoryItem,
  PaymentRecord,
  GetSubscriptionHistoryParams,
  GetPaymentHistoryParams,
} from '@/types/api';
import {
  isApiSuccess,
  parseApiErrorEnvelope,
} from '@/types/api';
import { getAuthHeaders, handleApiError } from '@/lib/api-utils';
import { getCsrfToken, invalidateCsrfToken } from '@/lib/csrf';
import { getApiBaseUrl } from '@/lib/api/base-url';
import type { AppError } from '@/types/errors';

// Re-export envelope utilities so other modules can import from a single place.
export { isApiSuccess, isApiError, parseApiErrorEnvelope, unwrapApiResponse } from '@/types/api';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const API_BASE = getApiBaseUrl();

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Detect an AppError-shaped plain object (not instanceof Error).
 * Returns a narrowed type so callers can access .recoverable without `any`.
 */
function isAppErrorLike(err: unknown): err is { code: string; recoverable: boolean } {
  return (
    err !== null &&
    typeof err === 'object' &&
    'code' in (err as object) &&
    'recoverable' in (err as object)
  );
}

/**
 * Convert a raw error envelope (from the server or a caught unknown) into an
 * AppError so all call-sites receive a consistent type.
 * No `any` — the `unknown` parameter forces explicit narrowing.
 */
function toAppError(raw: unknown): AppError {
  const envelope = parseApiErrorEnvelope(raw);

  const code = mapStatusToErrorCode(envelope.statusCode);

  return {
    code,
    message: envelope.message,
    severity: envelope.statusCode >= 500 ? 'error' : 'warning',
    category: statusToCategory(envelope.statusCode),
    recoverable: envelope.statusCode >= 500 || envelope.statusCode === 429,
    context: {
      statusCode: envelope.statusCode,
      correlationId: envelope.correlationId,
    },
  };
}

function mapStatusToErrorCode(status: number): AppError['code'] {
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 429) return 'RATE_LIMITED';
  if (status >= 500) return 'SERVICE_UNAVAILABLE';
  return 'API_ERROR';
}

function statusToCategory(status: number): AppError['category'] {
  if (status === 401 || status === 403) return 'auth';
  return 'server';
}

/**
 * Retry fn up to maxRetries times with exponential backoff + jitter.
 * Only retries when the thrown error is either:
 *   - Not AppError-shaped (raw TypeError, etc.)
 *   - AppError-shaped and recoverable === true
 *
 * This ensures non-recoverable AppErrors (FORBIDDEN, UNAUTHORIZED, etc.) are
 * propagated immediately without consuming retries.
 */
async function retryRequest<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;

      if (attempt === maxRetries) throw err;

      // Propagate non-recoverable AppErrors immediately.
      if (isAppErrorLike(err) && !err.recoverable) {
        throw err;
      }

      // Exponential backoff with jitter.
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * (baseDelay / 2);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

// ---------------------------------------------------------------------------
// ApiClient
// ---------------------------------------------------------------------------

class ApiClient {
  /**
   * Core request method.
   * Returns the parsed JSON body typed as T.
   * Throws AppError on non-2xx responses.
   */
  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const method = (options.method ?? 'GET').toUpperCase();

    const extraHeaders: HeadersInit = {};
    if (MUTATING.has(method)) {
      extraHeaders['x-csrf-token'] = await getCsrfToken();
    }

    const config: RequestInit = {
      ...options,
      credentials: 'include',
      headers: {
        ...getAuthHeaders(),
        ...extraHeaders,
        ...options.headers,
      },
    };

    return retryRequest(async () => {
      let response: Response;
      try {
        response = await fetch(url, config);
      } catch (networkErr: unknown) {
        // Network-level failures (no response) — convert to recoverable AppError.
        const appErr: AppError = {
          code: 'NETWORK_ERROR',
          message: networkErr instanceof Error ? networkErr.message : 'Network error',
          severity: 'error',
          category: 'network',
          recoverable: true,
        };
        throw appErr;
      }

      if (response.status === 403) {
        // Stale CSRF token — invalidate cache so next attempt re-fetches.
        invalidateCsrfToken();
      }

      if (!response.ok) {
        // Try to parse the backend error envelope for correlationId etc.
        let serverBody: unknown;
        try {
          serverBody = await response.json();
        } catch {
          serverBody = null;
        }

        // If the body looks like a backend envelope, derive AppError from it.
        if (
          serverBody !== null &&
          typeof serverBody === 'object' &&
          'statusCode' in (serverBody as object)
        ) {
          throw toAppError(serverBody);
        }

        // Fall back to the status-based helper.
        throw handleApiError(response, url);
      }

      return response.json() as Promise<T>;
    });
  }

  // ── User endpoints ────────────────────────────────────────────────────

  /**
   * Returns a normalised ApiResponse<User>.
   * Handles both the bare DTO shape and the wrapped `{ success, data }` shape
   * that the backend may return depending on the code path.
   */
  async getCurrentUser(): Promise<GetCurrentUserResponse> {
    const response = await this.request<User | ApiResponse<User>>('/users/me');

    // Discriminate: if it has a `success` field it is already an envelope.
    if (response !== null && typeof response === 'object' && 'success' in response) {
      return response as ApiResponse<User>;
    }

    // Wrap bare DTO into a success envelope.
    return { success: true, data: response as User };
  }

  async getUser(id: string): Promise<ApiResponse<User>> {
    return this.request<ApiResponse<User>>(`/users/${id}`);
  }

  async createUser(data: CreateUserRequest): Promise<ApiResponse<User>> {
    return this.request<ApiResponse<User>>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ── Post endpoints ────────────────────────────────────────────────────

  async getPosts(): Promise<GetPostsResponse> {
    return this.request<GetPostsResponse>('/posts');
  }

  async createPost(data: CreatePostRequest): Promise<ApiResponse<Post>> {
    return this.request<ApiResponse<Post>>('/posts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ── Subscription endpoints ────────────────────────────────────────────

  async getSubscriptions(): Promise<GetSubscriptionsResponse> {
    return this.request<GetSubscriptionsResponse>('/subscriptions');
  }

  async createSubscription(
    data: CreateSubscriptionRequest,
  ): Promise<ApiResponse<Subscription>> {
    return this.request<ApiResponse<Subscription>>('/subscriptions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getSubscriptionHistory(
    params: GetSubscriptionHistoryParams = {},
  ): Promise<PaginatedResponse<SubscriptionHistoryItem>> {
    const search = new URLSearchParams();
    if (params.status) search.set('status', params.status);
    if (params.sort) search.set('sort', params.sort);
    if (params.cursor) search.set('cursor', params.cursor);
    if (params.limit) search.set('limit', String(params.limit));
    const qs = search.toString();
    return this.request<PaginatedResponse<SubscriptionHistoryItem>>(
      `/subscriptions/me/list${qs ? `?${qs}` : ''}`,
    );
  }

  async getPaymentHistory(
    params: GetPaymentHistoryParams = {},
  ): Promise<PaginatedResponse<PaymentRecord>> {
    const search = new URLSearchParams();
    if (params.creator) search.set('creator', params.creator);
    if (params.from) search.set('from', params.from);
    if (params.to) search.set('to', params.to);
    if (params.page) search.set('page', String(params.page));
    if (params.limit) search.set('limit', String(params.limit));
    const qs = search.toString();
    return this.request<PaginatedResponse<PaymentRecord>>(
      `/analytics/payments${qs ? `?${qs}` : ''}`,
    );
  }

  async getCreatorSubscribers(
    params: {
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
      sort?: string;
      cursor?: string;
    } = {},
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    const search = new URLSearchParams();
    if (params.cursor) search.set('cursor', params.cursor);
    if (params.limit) search.set('limit', String(params.limit));
    if (params.status) search.set('status', params.status);
    if (params.sort) search.set('sort', params.sort);
    const qs = search.toString();
    return this.request<PaginatedResponse<Record<string, unknown>>>(
      `/subscriptions/me/creator-subscribers${qs ? `?${qs}` : ''}`,
    );
  }
}

export const apiClient = new ApiClient();

// React hook — returns the singleton (stable reference via useMemo).
export function useApiClient() {
  return useMemo(() => apiClient, []);
}

// ---------------------------------------------------------------------------
// Typed "orThrow" helpers — unwrap data or throw AppError
// ---------------------------------------------------------------------------

/**
 * Returns the current user's data or throws an AppError.
 * The error envelope's correlationId (when present) is included in context
 * for log correlation.
 */
export async function getCurrentUserOrThrow(): Promise<User> {
  const res = await apiClient.getCurrentUser();
  if (isApiSuccess(res)) return res.data;

  const errorRes = res as ApiErrorResponse;
  const appErr: AppError = {
    code: 'NOT_FOUND',
    message: errorRes.message || 'User not found',
    severity: 'error',
    category: 'server',
    recoverable: false,
    context: {
      correlationId: errorRes.correlationId,
      statusCode: errorRes.statusCode,
    },
  };
  throw appErr;
}
