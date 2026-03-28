import { Injectable, Logger } from '@nestjs/common';
import { EventBus } from '../events/event-bus';
import {
  SubscriptionCancelledEvent,
  SubscriptionRenewedEvent,
} from '../events/domain-events';
import { SubscriptionIndexerEventDto } from './dto/subscription-indexer-event.dto';
import { SubscriptionIndexRepository, SubscriptionStatus } from './repositories/subscription-index.repository';

@Injectable()
export class SubscriptionLifecycleIndexerService {
  private readonly logger = new Logger(SubscriptionLifecycleIndexerService.name);

  constructor(
    private readonly eventBus: EventBus,
    private readonly indexRepo: SubscriptionIndexRepository,
  ) {}

  async handleEvent(event: SubscriptionIndexerEventDto): Promise<void> {
    const fan = event.userId;
    const creator = event.creatorId;
    const now = Math.floor(Date.now() / 1000);

    if (event.event === 'renewed') {
      const expiry = event.expiry ?? now + 30 * 24 * 3600;
      const upsertData = {
        fan,
        creator,
        planId: event.planId,
        expiryUnix: expiry,
        status: SubscriptionStatus.ACTIVE,
      };
      const sub = await this.indexRepo.upsertManual(upsertData);
      this.eventBus.publish(
        new SubscriptionRenewedEvent(
          event.subscriptionId || sub.id,
          fan,
          creator,
          event.planId,
          expiry,
        ),
      );
      this.logger.log(`Indexed renewed sub ${event.subscriptionId} fan:${fan.slice(0,8)} -> ${creator.slice(0,8)}`);
      return;
    }

    if (event.event === 'cancelled') {
      await this.indexRepo.updateStatus(fan, creator, SubscriptionStatus.CANCELLED);
      this.eventBus.publish(
        new SubscriptionCancelledEvent(
          event.subscriptionId,
          fan,
          creator,
          event.planId,
          event.cancelledAt ?? now,
        ),
      );
      this.logger.log(`Indexed cancelled sub ${event.subscriptionId}`);
    }
  }
}
