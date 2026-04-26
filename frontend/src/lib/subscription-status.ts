export type SubscriptionStatus = 'active' | 'expired' | 'cancelled';

/** Value-level constants for SubscriptionStatus — importable from '@/types'. */
export const SUBSCRIPTION_STATUS_VALUES = {
  ACTIVE: 'active' as SubscriptionStatus,
  EXPIRED: 'expired' as SubscriptionStatus,
  CANCELLED: 'cancelled' as SubscriptionStatus,
} as const;

export interface SubscriptionStatusCopy {
  label: string;
  srLabel: string;
  helperText: string;
  ctaLabel: string;
}

const SUBSCRIPTION_STATUS_COPY: Record<SubscriptionStatus, SubscriptionStatusCopy> = {
  active: {
    label: 'Active',
    srLabel: 'Subscription status: active',
    helperText: 'Your subscription is active and gated content is unlocked.',
    ctaLabel: 'Manage subscription',
  },
  expired: {
    label: 'Expired',
    srLabel: 'Subscription status: expired',
    helperText: 'Your access has expired. Renew to unlock subscriber-only posts again.',
    ctaLabel: 'Renew subscription',
  },
  cancelled: {
    label: 'Cancelled',
    srLabel: 'Subscription status: cancelled',
    helperText: 'Your subscription was cancelled. Subscribe again to restore access.',
    ctaLabel: 'Subscribe again',
  },
};

const MOCK_VIEWER_SUBSCRIPTION_STATUS: Record<string, SubscriptionStatus> = {
  jane: 'active',
  alex: 'expired',
  maria: 'cancelled',
};

export function getSubscriptionStatusCopy(status: SubscriptionStatus): SubscriptionStatusCopy {
  return SUBSCRIPTION_STATUS_COPY[status];
}

export function isSubscriptionActive(
  status: SubscriptionStatus | null | undefined,
): status is 'active' {
  return status === 'active';
}

export function getMockViewerSubscriptionStatus(
  username: string,
): SubscriptionStatus | null {
  return MOCK_VIEWER_SUBSCRIPTION_STATUS[username.toLowerCase()] ?? null;
}
