export const SUBSCRIPTION_RENEWAL_FAILED = 'subscription.renewal_failed';

export interface RenewalFailurePayload {
  subscriptionId: string;
  reason?: string;
  timestamp: string;
  userId?: string;
}

export interface SubscriptionEventPublisher {
  emit(
    eventName: string,
    payload: RenewalFailurePayload,
  ): void | Promise<void>;
}

export const SUBSCRIPTION_EVENT_PUBLISHER = 'SUBSCRIPTION_EVENT_PUBLISHER';
