export const SUBSCRIPTION_RENEWAL_FAILED = 'subscription.renewal_failed';
export const SUBSCRIPTION_CREATED = 'subscription.created';
export const SUBSCRIPTION_CANCELLED = 'subscription.cancelled';

export interface SubscriptionEventPayload {
  subscriptionId?: string;
  fan?: string;
  creator?: string;
  planId?: number;
  reason?: string;
  timestamp: string;
  userId?: string;
}

/** @deprecated use SubscriptionEventPayload */
export type RenewalFailurePayload = SubscriptionEventPayload;

export interface SubscriptionEventPublisher {
  emit(
    eventName: string,
    payload: SubscriptionEventPayload,
  ): void | Promise<void>;
}

export const SUBSCRIPTION_EVENT_PUBLISHER = 'SUBSCRIPTION_EVENT_PUBLISHER';
