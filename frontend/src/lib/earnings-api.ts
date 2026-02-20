import { createAppError } from '@/types/errors';

export interface EarningsSummary {
  total_earnings: string;
  total_earnings_usd: number;
  pending_amount: string;
  available_for_withdrawal: string;
  currency: string;
  period_start: string;
  period_end: string;
}

export interface EarningsBreakdown {
  by_time: Array<{
    date: string;
    amount: string;
    currency: string;
    count: number;
  }>;
  by_plan: Array<{
    plan_id: string;
    plan_name: string;
    total_amount: string;
    currency: string;
    subscriber_count: number;
  }>;
  by_asset: Array<{
    asset: string;
    total_amount: string;
    percentage: number;
  }>;
}

export interface Transaction {
  id: string;
  date: string;
  type: 'subscription' | 'post_purchase' | 'tip' | 'withdrawal' | 'fee';
  description: string;
  amount: string;
  currency: string;
  status: 'completed' | 'pending' | 'failed';
  reference_id?: string;
  tx_hash?: string;
}

export interface Withdrawal {
  id: string;
  amount: string;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  completed_at?: string;
  destination_address: string;
  tx_hash?: string;
  fee: string;
  net_amount: string;
}

export interface FeeTransparency {
  protocol_fee_bps: number;
  protocol_fee_percentage: number;
  withdrawal_fee_fixed: string;
  withdrawal_fee_percentage: number;
  example_earnings: string;
  example_protocol_fee: string;
  example_net_earnings: string;
  example_withdrawal_fee: string;
  example_final_amount: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw createAppError('API_ERROR', {
        message: `API request failed: ${response.statusText}`,
        severity: 'error',
      });
    }

    return response.json();
  } catch (err) {
    throw createAppError('NETWORK_ERROR', {
      message: err instanceof Error ? err.message : 'Failed to fetch earnings data',
      cause: err instanceof Error ? err : undefined,
    });
  }
}

export async function fetchEarningsSummary(days: number = 30): Promise<EarningsSummary> {
  return fetchApi(`/earnings/summary?days=${days}`);
}

export async function fetchEarningsBreakdown(days: number = 30): Promise<EarningsBreakdown> {
  return fetchApi(`/earnings/breakdown?days=${days}`);
}

export async function fetchTransactionHistory(limit: number = 50, offset: number = 0): Promise<Transaction[]> {
  return fetchApi(`/earnings/transactions?limit=${limit}&offset=${offset}`);
}

export async function fetchWithdrawalHistory(limit: number = 20, offset: number = 0): Promise<Withdrawal[]> {
  return fetchApi(`/earnings/withdrawals?limit=${limit}&offset=${offset}`);
}

export async function requestWithdrawal(data: {
  amount: string;
  currency: string;
  destination_address: string;
  method: 'wallet' | 'bank';
}): Promise<Withdrawal> {
  return fetchApi('/earnings/withdraw', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function fetchFeeTransparency(): Promise<FeeTransparency> {
  return fetchApi('/earnings/fees');
}
