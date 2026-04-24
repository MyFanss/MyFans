import React from 'react';


import { useCallback, useMemo } from 'react';
import type { 
  ApiResponse, 
  User, CreateUserRequest, GetCurrentUserResponse, 
  Post, CreatePostRequest, GetPostsResponse, 
  Subscription, CreateSubscriptionRequest, GetSubscriptionsResponse 
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

  // Extensible: add more endpoints
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
      code: 'NOT_FOUND' as any,
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

