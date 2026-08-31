/**
 * Fan subscriptions API client.
 *
 * The active-subscriptions list is a private, per-user resource: it needs
 * the caller's bearer token (this app authenticates with a stored JWT, not
 * cookies — see `@/lib/auth-storage`) and an absolute, configuration-driven
 * base URL rather than a bare relative path, so it keeps working the same
 * way in every deployment instead of depending on an on-the-side rewrite.
 */
import { resolveAuthToken, clearStoredAuthToken } from '@/lib/auth-storage';
import { getApiBaseUrl } from '@/lib/api/base-url';
import type {
  ActiveSubscription,
  PaymentRecord,
  SubscriptionHistoryItem,
} from '@/lib/subscriptions';

const API_BASE = `${getApiBaseUrl()}/api/v1`;

export class SubscriptionsUnauthorizedError extends Error {
  readonly status = 401;

  constructor(message = 'Session expired. Please sign in again.') {
    super(message);
    this.name = 'SubscriptionsUnauthorizedError';
  }
}

function authHeaders(): HeadersInit {
  const token = resolveAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Normalize a raw list item from `GET /subscriptions/me/list` into the
 * `ActiveSubscription` shape the UI renders, defaulting any field the
 * backend omits so a partial record never crashes the page.
 */
function normalizeActiveSubscription(item: Record<string, unknown>): ActiveSubscription {
  return {
    id: String(item.id ?? ''),
    creatorId: String(item.creatorId ?? item.creator_id ?? ''),
    creatorName: String(item.creatorName ?? item.creator ?? 'Creator'),
    creatorUsername: String(item.creatorUsername ?? item.creator_username ?? ''),
    planName: String(item.planName ?? item.plan_name ?? 'Subscription'),
    price: typeof item.price === 'number' ? item.price : parseFloat(String(item.price ?? '0')),
    currency: String(item.currency ?? 'XLM'),
    interval: item.interval === 'year' ? 'year' : 'month',
    currentPeriodEnd: String(
      item.currentPeriodEnd ?? item.current_period_end ?? new Date().toISOString(),
    ),
    status: 'active',
  };
}

export interface FetchActiveSubscriptionsParams {
  status?: string;
  sort?: string;
}

/**
 * Fetch the current user's active subscriptions.
 *
 * Throws `SubscriptionsUnauthorizedError` on a 401 (and clears the stale
 * token) so callers can distinguish "not signed in" from a generic
 * network/server failure and avoid silently rendering an empty list.
 */
export async function fetchActiveSubscriptions(
  params: FetchActiveSubscriptionsParams = {},
): Promise<ActiveSubscription[]> {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.sort) qs.set('sort', params.sort);

  const res = await fetch(`${API_BASE}/subscriptions/me/list?${qs.toString()}`, {
    method: 'GET',
    headers: authHeaders(),
    credentials: 'include',
    cache: 'no-store',
  });

  if (res.status === 401) {
    clearStoredAuthToken();
    throw new SubscriptionsUnauthorizedError();
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? `Request failed: ${res.status}`);
  }

  const data = await res.json();
  const items: Record<string, unknown>[] = Array.isArray(data) ? data : (data.data ?? []);
  return items.map(normalizeActiveSubscription);
}

/**
 * Shared GET for the per-user subscription resources: same auth/credentials
 * shape as `fetchActiveSubscriptions`, same 401 → `SubscriptionsUnauthorizedError`
 * contract, and always returns a plain array (unwrapping `{ data: [...] }`).
 */
async function getSubscriptionList(path: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'GET',
    headers: authHeaders(),
    credentials: 'include',
    cache: 'no-store',
  });

  if (res.status === 401) {
    clearStoredAuthToken();
    throw new SubscriptionsUnauthorizedError();
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? `Request failed: ${res.status}`);
  }

  const data = await res.json();
  return Array.isArray(data) ? data : (data.data ?? []);
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  const parsed = parseFloat(String(value ?? '0'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeHistoryItem(item: Record<string, unknown>): SubscriptionHistoryItem {
  return {
    id: String(item.id ?? ''),
    creatorName: String(item.creatorName ?? item.creator ?? 'Creator'),
    creatorUsername: String(item.creatorUsername ?? item.creator_username ?? ''),
    planName: String(item.planName ?? item.plan_name ?? 'Subscription'),
    price: toNumber(item.price),
    currency: String(item.currency ?? 'XLM'),
    startedAt: String(item.startedAt ?? item.createdAt ?? new Date().toISOString()),
    endedAt: String(item.endedAt ?? item.currentPeriodEnd ?? new Date().toISOString()),
    cancelReason: item.cancelReason ? String(item.cancelReason) : undefined,
  };
}

const PAYMENT_STATUSES: PaymentRecord['status'][] = [
  'completed',
  'pending',
  'failed',
  'refunded',
];

function normalizePaymentRecord(item: Record<string, unknown>): PaymentRecord {
  const rawStatus = String(item.status ?? 'completed') as PaymentRecord['status'];
  return {
    id: String(item.id ?? ''),
    date: String(item.date ?? item.paidAt ?? item.createdAt ?? new Date().toISOString()),
    creatorName: String(item.creatorName ?? item.creator ?? 'Creator'),
    planName: String(item.planName ?? item.plan_name ?? 'Subscription'),
    amount: toNumber(item.amount),
    currency: String(item.currency ?? item.asset ?? 'XLM'),
    status: PAYMENT_STATUSES.includes(rawStatus) ? rawStatus : 'completed',
    description: item.description ? String(item.description) : undefined,
  };
}

/**
 * Fetch the current user's ended (cancelled/expired) subscriptions for the
 * history section. Throws `SubscriptionsUnauthorizedError` on a 401.
 */
export async function fetchSubscriptionHistory(): Promise<SubscriptionHistoryItem[]> {
  const items = await getSubscriptionList('/subscriptions/me/list?status=cancelled');
  return items.map(normalizeHistoryItem);
}

/**
 * Fetch the current user's payment records. Throws
 * `SubscriptionsUnauthorizedError` on a 401.
 */
export async function fetchPaymentHistory(): Promise<PaymentRecord[]> {
  const items = await getSubscriptionList('/analytics/payments');
  return items.map(normalizePaymentRecord);
}
