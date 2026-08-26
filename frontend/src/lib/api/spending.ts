import { getVersionedApiBaseUrl } from './base-url';
import { createAppError } from '@/types/errors';
import { resolveAuthToken } from '@/lib/auth-storage';

const API_BASE = getVersionedApiBaseUrl();

export interface SpendingRecord {
  id: string;
  type: 'subscription' | 'tip' | 'purchase';
  amount: string;
  currency: string;
  creatorName: string;
  creatorUsername: string;
  date: string;
  status: 'completed' | 'pending' | 'failed';
}

export interface SpendingHistory {
  items: SpendingRecord[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  totalSpent: string;
  currency: string;
}

function getHeaders(): HeadersInit {
  const token = resolveAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Get spending history for the authenticated fan/user.
 */
export async function getSpendingHistory(
  page: number = 1,
  limit: number = 20,
  days?: number,
): Promise<SpendingHistory> {
  try {
    const qs = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });

    if (days) {
      qs.set('days', String(days));
    }

    const response = await fetch(`${API_BASE}/spending-cap?${qs.toString()}`, {
      credentials: 'include',
      headers: getHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 401) {
        throw createAppError('UNAUTHORIZED', {
          message: 'Authentication required',
        });
      }
      throw createAppError('API_ERROR', {
        message: (errorData as any).message ?? 'Failed to fetch spending history',
      });
    }

    return response.json();
  } catch (err) {
    if (typeof err === 'object' && err !== null && 'code' in err) {
      throw err;
    }
    throw createAppError('NETWORK_ERROR', {
      message: err instanceof Error ? err.message : 'Failed to fetch spending history',
      cause: err instanceof Error ? err : undefined,
    });
  }
}
