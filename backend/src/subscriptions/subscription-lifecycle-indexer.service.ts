import { Injectable } from '@nestjs/common';
import { EventBus } from '../events/event-bus';
import {
  SubscriptionCancelledEvent,
  SubscriptionRenewedEvent,
} from '../events/domain-events';
import { SubscriptionIndexerEventDto } from './dto/subscription-indexer-event.dto';

@Injectable()
export class SubscriptionLifecycleIndexerService {
  constructor(private readonly eventBus: EventBus) {}

  handleEvent(event: SubscriptionIndexerEventDto): void {
    if (event.event === 'renewed') {
      this.eventBus.publish(
        new SubscriptionRenewedEvent(
          event.subscriptionId,
          event.userId,
          event.creatorId,
          event.planId,
          event.expiry ?? Date.now(),
        ),
      );
      return;
    }

    this.eventBus.publish(
      new SubscriptionCancelledEvent(
        event.subscriptionId,
        event.userId,
        event.creatorId,
        event.planId,
        event.cancelledAt ?? Date.now(),
      ),
    );
  }
}
