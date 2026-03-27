/**
 * Stable string identifiers for persisted audit rows.
 * Use dotted namespaces so filters and dashboards stay consistent.
 */
export const AuditableAction = {
  AUTH_SESSION_CREATED: 'auth.session_created',
  WEBHOOK_SECRET_ROTATED: 'webhook.secret_rotated',
  WEBHOOK_SECRET_EXPIRED_PREVIOUS: 'webhook.secret_expired_previous',
  SUBSCRIPTION_CHECKOUT_CONFIRMED: 'subscription.checkout_confirmed',
  SUBSCRIPTION_CHECKOUT_FAILED: 'subscription.checkout_failed',
} as const;

export type AuditableActionName =
  (typeof AuditableAction)[keyof typeof AuditableAction];

export type AuditActorType = 'user' | 'system' | 'service' | 'anonymous';
