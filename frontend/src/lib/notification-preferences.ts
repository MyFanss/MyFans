/**
 * Notification preferences API + types.
 *
 * Covers channel-level toggles (email / push / marketing) and
 * per-event toggles for each channel.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface NotificationPreferences {
  // Channel master switches
  email_notifications: boolean;
  push_notifications: boolean;
  marketing_emails: boolean;
  // Per-event: email
  email_new_subscriber: boolean;
  email_subscription_renewal: boolean;
  email_new_comment: boolean;
  email_new_like: boolean;
  email_new_message: boolean;
  email_payout: boolean;
  // Per-event: push
  push_new_subscriber: boolean;
  push_subscription_renewal: boolean;
  push_new_comment: boolean;
  push_new_like: boolean;
  push_new_message: boolean;
  push_payout: boolean;
}

export type PreferenceKey = keyof NotificationPreferences;

/** Human-readable metadata for each event type */
export interface EventMeta {
  key: string;
  label: string;
  description: string;
}

export const EVENT_TYPES: EventMeta[] = [
  {
    key: 'new_subscriber',
    label: 'New subscriber',
    description: 'When someone subscribes to your plan',
  },
  {
    key: 'subscription_renewal',
    label: 'Subscription renewal',
    description: 'When a subscription renews successfully',
  },
  {
    key: 'new_comment',
    label: 'New comment',
    description: 'When someone comments on your content',
  },
  {
    key: 'new_like',
    label: 'New like',
    description: 'When someone likes your post',
  },
  {
    key: 'new_message',
    label: 'New message',
    description: 'When you receive a direct message',
  },
  {
    key: 'payout',
    label: 'Payout sent',
    description: 'When a payout is processed to your wallet',
  },
];

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  email_notifications: true,
  push_notifications: false,
  marketing_emails: false,
  email_new_subscriber: true,
  email_subscription_renewal: true,
  email_new_comment: true,
  email_new_like: false,
  email_new_message: true,
  email_payout: true,
  push_new_subscriber: true,
  push_subscription_renewal: true,
  push_new_comment: true,
  push_new_like: true,
  push_new_message: true,
  push_payout: false,
};

// ── API ────────────────────────────────────────────────────────────────────

const API_BASE = 'http://localhost:3001/api/v1';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ?? `Request failed: ${res.status}`,
    );
  }
  return res.json() as Promise<T>;
}

export async function fetchNotificationPreferences(): Promise<NotificationPreferences> {
  return apiFetch<NotificationPreferences>('/users/me/notifications');
}

export async function saveNotificationPreferences(
  prefs: Partial<NotificationPreferences>,
): Promise<{ message: string; preferences: NotificationPreferences }> {
  return apiFetch('/users/me/notifications', {
    method: 'PATCH',
    body: JSON.stringify(prefs),
  });
}
