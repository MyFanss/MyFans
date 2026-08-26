import { getApiBaseUrl, getVersionedApiBaseUrl } from './base-url';
import { createAppError } from '@/types/errors';
import { resolveAuthToken } from '@/lib/auth-storage';

const API_BASE = getVersionedApiBaseUrl();

export interface CreatorPlan {
  id: number;
  creator: string;
  asset: string;
  amount: string;
  intervalDays: number;
  syncStatus?: 'synced' | 'stale' | 'missing' | 'unknown';
  lastSyncedAt?: string;
}

export interface CreatePlanRequest {
  creator: string;
  asset: string;
  amount: string;
  intervalDays: number;
}

export interface PaginatedPlans {
  data: CreatorPlan[];
  limit: number;
  page: number;
  total: number;
  total_pages: number;
}

function getHeaders(includeIdempotencyKey: boolean = false, idempotencyKey?: string): HeadersInit {
  const token = resolveAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (includeIdempotencyKey && idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  return headers;
}

/**
 * Create a new subscription plan for the authenticated creator.
 * Uses idempotency key to prevent duplicate plan creation on retries.
 */
export async function createPlan(
  request: CreatePlanRequest,
  idempotencyKey: string,
): Promise<CreatorPlan> {
  try {
    const response = await fetch(`${API_BASE}/creators/plans`, {
      method: 'POST',
      credentials: 'include',
      headers: getHeaders(true, idempotencyKey),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 403) {
        throw createAppError('UNAUTHORIZED', {
          message: 'You do not have permission to create plans',
          description: 'Only creators can create subscription plans.',
        });
      }
      if (response.status === 400) {
        throw createAppError('VALIDATION_ERROR', {
          message: (errorData as any).message ?? 'Invalid plan data',
          description: (errorData as any).description,
        });
      }
      throw createAppError('API_ERROR', {
        message: (errorData as any).message ?? 'Failed to create plan',
      });
    }

    return response.json();
  } catch (err) {
    if (typeof err === 'object' && err !== null && 'code' in err) {
      throw err;
    }
    throw createAppError('NETWORK_ERROR', {
      message: err instanceof Error ? err.message : 'Failed to create plan',
      cause: err instanceof Error ? err : undefined,
    });
  }
}

/**
 * List subscription plans for a specific creator address.
 */
export async function getCreatorPlans(creatorAddress: string, page: number = 1, limit: number = 20): Promise<PaginatedPlans> {
  try {
    const qs = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });

    const response = await fetch(`${API_BASE}/creators/${encodeURIComponent(creatorAddress)}/plans?${qs.toString()}`, {
      credentials: 'include',
      headers: getHeaders(false),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 403) {
        throw createAppError('UNAUTHORIZED', {
          message: 'You do not have permission to view these plans',
        });
      }
      throw createAppError('API_ERROR', {
        message: (errorData as any).message ?? 'Failed to fetch plans',
      });
    }

    return response.json();
  } catch (err) {
    if (typeof err === 'object' && err !== null && 'code' in err) {
      throw err;
    }
    throw createAppError('NETWORK_ERROR', {
      message: err instanceof Error ? err.message : 'Failed to fetch plans',
      cause: err instanceof Error ? err : undefined,
    });
  }
}

/**
 * Generate a stable idempotency key for a plan creation request.
 * Uses creator address, asset, amount, and interval to create a deterministic key.
 */
export function generatePlanIdempotencyKey(request: CreatePlanRequest): string {
  // Create a stable key based on plan parameters
  const key = `${request.creator}:${request.asset}:${request.amount}:${request.intervalDays}`;
  // Use a simple hash or prefix for readability
  return `plan-${Buffer.from(key).toString('base64').replace(/=/g, '').substring(0, 16)}`;
}
