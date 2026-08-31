import { getApiBaseUrl } from '@/lib/api/base-url';

/** UI transaction row used by the transactions page table. */
export interface Transaction {
  id: string;
  type: 'subscription' | 'payment' | 'refund';
  status: 'pending' | 'success' | 'failed';
  amount: number;
  currency: string;
  txHash?: string;
  createdAt: string;
}

/** Shape returned by Nest `GET /v1/analytics/payments`. */
export interface BackendPaymentRecord {
  id: string;
  creator: string;
  fan: string;
  amount: string;
  fee: string;
  asset: string;
  txHash: string;
  paidAt: string;
  /** Optional — present once the backend records lifecycle state. */
  status?: string;
  type?: string;
}

const TRANSACTION_TYPES: Transaction['type'][] = ['subscription', 'payment', 'refund'];
const TRANSACTION_STATUSES: Transaction['status'][] = ['pending', 'success', 'failed'];

/** Map assorted backend status spellings onto the UI's three states. */
export function normalizeTransactionStatus(raw: unknown): Transaction['status'] {
  const value = String(raw ?? '').toLowerCase();
  if (value === 'confirmed' || value === 'complete' || value === 'completed' || value === 'success') {
    return 'success';
  }
  if (value === 'failed' || value === 'error' || value === 'rejected') {
    return 'failed';
  }
  if (value === 'pending' || value === 'processing' || value === 'submitted') {
    return 'pending';
  }
  return TRANSACTION_STATUSES.includes(value as Transaction['status'])
    ? (value as Transaction['status'])
    : 'success';
}

/** Map assorted backend type spellings onto the UI's three types. */
export function normalizeTransactionType(raw: unknown): Transaction['type'] {
  const value = String(raw ?? '').toLowerCase();
  if (value === 'subscription' || value === 'sub') return 'subscription';
  if (value === 'refund' || value === 'chargeback') return 'refund';
  return TRANSACTION_TYPES.includes(value as Transaction['type'])
    ? (value as Transaction['type'])
    : 'payment';
}

export interface TransactionsQuery {
  page?: number;
  limit?: number;
  creator?: string;
  from?: string;
  to?: string;
  type?: string;
  status?: string;
}

export interface TransactionsResponse {
  data: Transaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Absolute Nest URL for analytics payments (server-side proxy target).
 */
export function getAnalyticsPaymentsUrl(): string {
  const base = getApiBaseUrl();
  if (base.endsWith('/api/v1') || base.endsWith('/v1')) {
    return `${base}/analytics/payments`;
  }
  if (base.endsWith('/api')) {
    return `${base}/v1/analytics/payments`;
  }
  return `${base}/v1/analytics/payments`;
}

export function mapPaymentToTransaction(payment: BackendPaymentRecord): Transaction {
  return {
    id: payment.id,
    type: normalizeTransactionType(payment.type),
    status: normalizeTransactionStatus(payment.status),
    amount: parseFloat(payment.amount) || 0,
    currency: payment.asset || 'XLM',
    txHash: payment.txHash || undefined,
    createdAt: payment.paidAt,
  };
}

export function mapPaymentsResponse(payload: unknown): TransactionsResponse {
  const body = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
  const rawItems = Array.isArray(body.data) ? body.data : Array.isArray(payload) ? payload : [];

  const data = rawItems.map((item) => {
    const record = item as Partial<BackendPaymentRecord> & Record<string, unknown>;
    return mapPaymentToTransaction({
      id: String(record.id ?? ''),
      creator: String(record.creator ?? ''),
      fan: String(record.fan ?? ''),
      amount: String(record.amount ?? '0'),
      fee: String(record.fee ?? '0'),
      asset: String(record.asset ?? record.currency ?? 'XLM'),
      txHash: String(record.txHash ?? ''),
      paidAt: String(record.paidAt ?? record.date ?? record.createdAt ?? new Date().toISOString()),
      status: record.status != null ? String(record.status) : undefined,
      type: record.type != null ? String(record.type) : undefined,
    });
  });

  const page = typeof body.page === 'number' ? body.page : 1;
  const limit = typeof body.limit === 'number' ? body.limit : 10;
  const total = typeof body.total === 'number' ? body.total : data.length;
  const totalPages =
    typeof body.totalPages === 'number' ? body.totalPages : Math.max(1, Math.ceil(total / limit));

  return { data, total, page, limit, totalPages };
}
