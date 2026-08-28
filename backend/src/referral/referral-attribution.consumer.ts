import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventBus } from '../events/event-bus';
import { SubscriptionCreatedEvent } from '../events/domain-events';
import { ReferralService } from './referral.service';

/**
 * Bridges the subscription domain to the referral program.
 *
 * Referrals are attributed on `SubscriptionCreatedEvent` only. Renewal,
 * cancellation and expiry events are intentionally not subscribed to, which
 * is what guarantees "code applies on first subscribe" and "renew does not
 * re-pay".
 */
@Injectable()
export class ReferralAttributionConsumer implements OnModuleInit {
  private readonly logger = new Logger(ReferralAttributionConsumer.name);

  constructor(
    private readonly eventBus: EventBus,
    private readonly referralService: ReferralService,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe(
      'subscription.created',
      (event: SubscriptionCreatedEvent) => {
        void this.referralService
          .attributeForSubscriber(event.fan)
          .catch((err: unknown) => {
            const reason = err instanceof Error ? err.message : String(err);
            this.logger.error(
              `Referral attribution failed for ${event.fan}: ${reason}`,
            );
          });
      },
    );
  }
}
