export interface WebhookEvent {
  id: string;
  type: string;
  timestamp: number;
  data: Record<string, unknown>;
}

export type WebhookEventType =
  | 'subscription.created'
  | 'subscription.renewed'
  | 'subscription.cancelled'
  | 'subscription.expired'
  | 'subscription.renewal_failed'
  | 'payment.completed'
  | 'payment.failed'
  | 'creator.plan_created'
  | 'post.deleted'
  | 'user.logged_in';

export const KNOWN_EVENT_TYPES = new Set<string>([
  'subscription.created',
  'subscription.renewed',
  'subscription.cancelled',
  'subscription.expired',
  'subscription.renewal_failed',
  'payment.completed',
  'payment.failed',
  'creator.plan_created',
  'post.deleted',
  'user.logged_in',
]);
