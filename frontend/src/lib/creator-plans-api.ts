import { createAppError } from '@/types/errors';
import { getVersionedApiBaseUrl } from '@/lib/api/base-url';

export interface PlanDto {
  id: number;
  creator: string;
  asset: string;
  amount: string;
  intervalDays: number;
  syncStatus?: 'synced' | 'stale' | 'missing' | 'unknown';
  lastSyncedAt?: Date;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  try {
    const response = await fetch(`${getVersionedApiBaseUrl()}${endpoint}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw createAppError('INTERNAL_ERROR', {
        message: `API request failed: ${response.statusText}`,
        severity: 'error',
      });
    }

    return response.json();
  } catch (err) {
    throw createAppError('NETWORK_ERROR', {
      message: err instanceof Error ? err.message : 'Failed to fetch plan data',
      cause: err instanceof Error ? err : undefined,
    });
  }
}

export async function fetchCreatorPlans(
  creatorAddress: string,
  page: number = 1,
  limit: number = 50,
): Promise<PaginatedResponse<PlanDto>> {
  return fetchApi(
    `/creators/${encodeURIComponent(creatorAddress)}/plans?page=${page}&limit=${limit}`,
  );
}

export async function getCreatorPlanById(
  creatorAddress: string,
  planId: number,
): Promise<PlanDto | null> {
  try {
    const response = await fetchCreatorPlans(creatorAddress, 1, 100);
    return response.items.find((p) => p.id === planId) ?? null;
  } catch (err) {
    throw createAppError('PLAN_FETCH_FAILED', {
      message: 'Failed to fetch plan details',
      cause: err instanceof Error ? err : undefined,
    });
  }
}
