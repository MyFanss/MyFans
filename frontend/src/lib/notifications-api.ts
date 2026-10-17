/**
 * Notifications API client.
 *
 * Wires the notifications inbox and preferences form to the live
 * NotificationsModule backend endpoints.  Mock data must only be used in
 * tests — never in production builds.
 *
 * Covered endpoints:
 *   GET    /api/v1/notifications           — paginated inbox
 *   PATCH  /api/v1/notifications/:id/read  — mark one as read (CSRF)
 *   POST   /api/v1/notifications/read-all  — mark all as read (CSRF)
 *   GET    /api/v1/notification-preferences        — fetch prefs
 *   PATCH  /api/v1/notification-preferences        — update prefs (CSRF)
 *
 * Refs: #1830, frontend/e2e/notifications.spec.ts,
 *       frontend/e2e/notification-preferences.spec.ts
 */

import { apiFetch } from '@/lib/api/client';

// ── Types ─────────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  /** ISO timestamp */
  createdAt: string;
  /** For digest notifications: how many events are batched. */
  digestCount?: number;
  /** Summary of batched events for digest types. */
  digestSummary?: string;
}

export interface NotificationsPage {
  data: Notification[];
  nextCursor: string | null;
  hasMore: boolean;
}

export type NotificationChannel = 'email' | 'push' | 'marketing';
export type NotificationEvent = 'new_subscriber' | 'payout_sent' | 'subscription_renewed' | 'new_message';

export interface NotificationPreferences {
  /** Master channel switches */
  emailEnabled: boolean;
  pushEnabled: boolean;
  marketingEmailsEnabled: boolean;
  /** Per-event per-channel overrides */
  events: Partial<Record<`${NotificationEvent}_${NotificationChannel}`, boolean>>;
}

// ── Notifications inbox ───────────────────────────────────────────────────

export async function fetchNotifications(
  filter: 'all' | 'unread' = 'all',
  cursor?: string,
): Promise<NotificationsPage> {
  const params = new URLSearchParams({ filter, limit: '20' });
  if (cursor) params.set('cursor', cursor);
  const res = await apiFetch(`/api/v1/notifications?${params.toString()}`);
  if (!res.ok) throw new Error(`fetchNotifications failed: ${res.status}`);
  return (await res.json()) as NotificationsPage;
}

export async function markNotificationRead(id: string): Promise<void> {
  const res = await apiFetch(`/api/v1/notifications/${encodeURIComponent(id)}/read`, {
    method: 'PATCH',
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`markRead failed: ${res.status}`);
}

export async function markAllNotificationsRead(): Promise<void> {
  const res = await apiFetch('/api/v1/notifications/read-all', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`markAllRead failed: ${res.status}`);
}

// ── Notification preferences ──────────────────────────────────────────────

export async function fetchNotificationPreferences(): Promise<NotificationPreferences> {
  const res = await apiFetch('/api/v1/notification-preferences');
  if (!res.ok) throw new Error(`fetchPrefs failed: ${res.status}`);
  return (await res.json()) as NotificationPreferences;
}

/**
 * Persist notification preferences.  CSRF token attached automatically.
 */
export async function updateNotificationPreferences(
  payload: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  const res = await apiFetch('/api/v1/notification-preferences', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`updatePrefs failed: ${res.status}`);
  return (await res.json()) as NotificationPreferences;
}
