import { useMemo } from 'react';
import type { 
  ApiResponse, 
  User, CreateUserRequest, GetCurrentUserResponse, 
  Post, CreatePostRequest, GetPostsResponse, 
  Subscription, CreateSubscriptionRequest, GetSubscriptionsResponse,
  PaginatedResponse, SubscriptionHistoryItem, PaymentRecord,
  GetSubscriptionHistoryParams, GetPaymentHistoryParams
} from '@/types';
import { retryWithBackoff, getAuthHeaders, handleApiError, shouldRetry } from '@/lib/api-utils';
import { getCsrfToken, invalidateCsrfToken } from '@/lib/csrf';
import type { AppError } from '@/types';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

class ApiClient {
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

    return retryWithBackoff(async () => {
      const response = await fetch(url, config);

      if (response.status === 403) {
        // Stale CSRF token — invalidate cache so next attempt re-fetches
        invalidateCsrfToken();
      }

      if (!response.ok) {
        const appError = handleApiError(response, url);
        if (!shouldRetry(appError)) throw appError;
        throw appError;
      }

      return response.json() as Promise<T>;
    });
  }

  // User endpoints
  async getCurrentUser(): Promise<GetCurrentUserResponse> {
    return this.request<ApiResponse<User>>('/users/me');
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

  // Post endpoints
  async getPosts(): Promise<GetPostsResponse> {
    return this.request<GetPostsResponse>('/posts');
  }

  async createPost(data: CreatePostRequest): Promise<ApiResponse<Post>> {
    return this.request<ApiResponse<Post>>('/posts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Subscription endpoints
  async getSubscriptions(): Promise<GetSubscriptionsResponse> {
    return this.request<GetSubscriptionsResponse>('/subscriptions');
  }

  async createSubscription(data: CreateSubscriptionRequest): Promise<ApiResponse<Subscription>> {
    return this.request<ApiResponse<Subscription>>('/subscriptions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getSubscriptionHistory(params: GetSubscriptionHistoryParams = {}): Promise<PaginatedResponse<SubscriptionHistoryItem>> {
    const search = new URLSearchParams();
    if (params.status) search.set('status', params.status);
    if (params.sort) search.set('sort', params.sort);
    if (params.cursor) search.set('cursor', params.cursor);
    if (params.limit) search.set('limit', String(params.limit));
    const queryString = search.toString();
    return this.request<PaginatedResponse<SubscriptionHistoryItem>>(`/subscriptions/me/list${queryString ? `?${queryString}` : ''}`);
  }

  async getPaymentHistory(params: GetPaymentHistoryParams = {}): Promise<PaginatedResponse<PaymentRecord>> {
    const search = new URLSearchParams();
    if (params.creator) search.set('creator', params.creator);
    if (params.from) search.set('from', params.from);
    if (params.to) search.set('to', params.to);
    if (params.page) search.set('page', String(params.page));
    if (params.limit) search.set('limit', String(params.limit));
    const queryString = search.toString();
    return this.request<PaginatedResponse<PaymentRecord>>(`/analytics/payments${queryString ? `?${queryString}` : ''}`);
  }
}

export const apiClient = new ApiClient();

// React hook
export function useApiClient() {
  return useMemo(() => apiClient, []);
}

// Typed helpers (throw AppError on failure)
export async function getCurrentUserOrThrow(): Promise<User> {
  const res = await apiClient.getCurrentUser();
  if (!res.success) {
    const error: AppError = {
      code: 'NOT_FOUND',
      message: res.error || 'User not found',
      severity: 'error',
      category: 'server',
      recoverable: false,
    };
    throw error;
  }
  return res.data!;
}


// Add more orThrow helpers as needed

