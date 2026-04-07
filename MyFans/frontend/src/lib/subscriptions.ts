/**
 * Fan subscription management: active list, history, payment history.
 * Replace with API when backend is ready.
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

const now = new Date();
const fmt = (d: Date, days: number) => new Date(d.getTime() + days * 86400000).toISOString();

export const MOCK_ACTIVE: ActiveSubscription[] = [
  {
    id: 'sub-1',
    creatorId: 'c1',
    creatorName: 'Jane Doe',
    creatorUsername: 'jane',
    planName: 'Pro',
    price: 9.99,
    currency: 'USD',
    interval: 'month',
    currentPeriodEnd: fmt(now, 12),
    status: 'active',
  },
  {
    id: 'sub-2',
    creatorId: 'c2',
    creatorName: 'Alex Chen',
    creatorUsername: 'alex',
    planName: 'Patron',
    price: 9.99,
    currency: 'USD',
    interval: 'month',
    currentPeriodEnd: fmt(now, 25),
    status: 'active',
  },
];

export const MOCK_HISTORY: SubscriptionHistoryItem[] = [
  {
    id: 'hist-1',
    creatorName: 'Studio Art',
    creatorUsername: 'studioart',
    planName: 'Basic',
    price: 4.99,
    currency: 'USD',
    startedAt: fmt(now, -60),
    endedAt: fmt(now, -5),
    cancelReason: 'Cancelled by user',
  },
];

export const MOCK_PAYMENTS: PaymentRecord[] = [
  { id: 'pay-1', date: fmt(now, -2), creatorName: 'Jane Doe', planName: 'Pro', amount: 9.99, currency: 'USD', status: 'completed' },
  { id: 'pay-2', date: fmt(now, -32), creatorName: 'Alex Chen', planName: 'Patron', amount: 9.99, currency: 'USD', status: 'completed' },
  { id: 'pay-3', date: fmt(now, -62), creatorName: 'Studio Art', planName: 'Basic', amount: 4.99, currency: 'USD', status: 'completed' },
];

export function getCurrencySymbol(currency: string): string {
  const map: Record<string, string> = { USD: '$', EUR: '€', GBP: '£' };
  return map[currency] ?? currency;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
