/**
 * Fan subscription UI types.
 *
 * Data is fetched from the backend `/v1` API via `@/lib/api/subscriptions`
 * (`fetchActiveSubscriptions`, `fetchSubscriptionHistory`,
 * `fetchPaymentHistory`). This file is types only — there is no mock data.
 */

export interface ActiveSubscription {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorUsername: string;
  planName: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  currentPeriodEnd: string; // ISO
  status: 'active';
}

export interface SubscriptionHistoryItem {
  id: string;
  creatorName: string;
  creatorUsername: string;
  planName: string;
  price: number;
  currency: string;
  startedAt: string;
  endedAt: string;
  cancelReason?: string;
}

export interface PaymentRecord {
  id: string;
  date: string; // ISO
  creatorName: string;
  planName: string;
  amount: number;
  currency: string;
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  description?: string;
}
