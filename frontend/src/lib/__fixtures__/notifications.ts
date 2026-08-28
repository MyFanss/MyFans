/**
 * Test-only notification fixtures.
 *
 * Not imported by any production code path — the inbox and preferences UI
 * are wired straight to the live NotificationsModule API. Kept here so unit
 * tests have a realistic, mixed (read/unread), newest-first dataset.
 */
import type { Notification } from '@/lib/notifications';

const now = new Date();
const ago = (minutes: number) =>
  new Date(now.getTime() - minutes * 60_000).toISOString();

export const MOCK_NOTIFICATIONS: Notification[] = [
  { id: '1', user_id: 'u1', type: 'new_subscriber', title: 'New subscriber', body: '@alex_fan subscribed to your Premium plan', is_read: false, metadata: null, created_at: ago(5), digest_count: 1, digest_event_times: null },
  { id: '2', user_id: 'u1', type: 'subscription_renewed', title: '3 subscriptions renewed', body: '3 subscription renewals have been processed.', is_read: false, metadata: null, created_at: ago(32), digest_count: 3, digest_event_times: [ago(32), ago(28), ago(20)] },
  { id: '3', user_id: 'u1', type: 'new_comment', title: 'New comment', body: '@sam_user commented on "Behind the scenes"', is_read: false, metadata: null, created_at: ago(90), digest_count: 1, digest_event_times: null },
  { id: '4', user_id: 'u1', type: 'payout_sent', title: 'Payout sent', body: 'Your weekly payout of $420.00 has been sent', is_read: true, metadata: { amount: 420 }, created_at: ago(120), digest_count: 1, digest_event_times: null },
  { id: '5', user_id: 'u1', type: 'new_like', title: '5 new likes', body: 'You have 5 new likes on your posts.', is_read: true, metadata: null, created_at: ago(200), digest_count: 5, digest_event_times: [ago(200), ago(195), ago(190), ago(185), ago(180)] },
  { id: '6', user_id: 'u1', type: 'subscription_cancelled', title: 'Subscription cancelled', body: '@old_fan cancelled their Premium plan', is_read: true, metadata: null, created_at: ago(300), digest_count: 1, digest_event_times: null },
  { id: '7', user_id: 'u1', type: 'system', title: 'Welcome to MyFans', body: 'Your account is set up and ready to go', is_read: true, metadata: null, created_at: ago(1440), digest_count: 1, digest_event_times: null },
];
