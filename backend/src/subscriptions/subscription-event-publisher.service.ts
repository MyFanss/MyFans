import { Injectable, Logger } from '@nestjs/common';
import type { SubscriptionEventPayload, SubscriptionEventPublisher } from './events';

/**
 * Default SUBSCRIPTION_EVENT_PUBLISHER implementation. Surfaces subscription
 * lifecycle events (created/cancelled/renewal_failed) to the application log
 * stream so external log-based alerting/shipping can pick them up, replacing
 * the previous no-op `{ emit: () => undefined }` provider.
 */
@Injectable()
export class LoggingSubscriptionEventPublisher
  implements SubscriptionEventPublisher
{
  private readonly logger = new Logger(LoggingSubscriptionEventPublisher.name);

  emit(eventName: string, payload: SubscriptionEventPayload): void {
    this.logger.log(`subscription_event=${eventName} ${JSON.stringify(payload)}`);
  }
}
