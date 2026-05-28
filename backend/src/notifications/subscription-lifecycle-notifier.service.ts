import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventBus } from '../events/event-bus';
import {
  SubscriptionCancelledEvent,
  SubscriptionRenewedEvent,
  SubscriptionRenewalFailedEvent,
} from '../events/domain-events';
import { NotificationsService } from './notifications.service';

@Injectable()
export class SubscriptionLifecycleNotifierService implements OnModuleInit {
  constructor(
    private readonly eventBus: EventBus,
    private readonly notificationsService: NotificationsService,
  ) { }

  onModuleInit(): void {
    this.eventBus.subscribe('subscription.renewed', (event: SubscriptionRenewedEvent) => {
      void this.notificationsService.enqueueSubscriptionLifecycleNotification({
        dedupeKey: `subscription.renewed:${event.subscriptionId}:${event.expiry}`,
        event: 'renewed',
        recipientUserId: event.fan,
        creatorUserId: event.creator,
        creatorDisplayName: event.creator,
        subscriptionId: event.subscriptionId,
        planId: event.planId,
        occurredAt: new Date(event.timestamp),
      });
    });

    this.eventBus.subscribe('subscription.cancelled', (event: SubscriptionCancelledEvent) => {
      void this.notificationsService.enqueueSubscriptionLifecycleNotification({
        dedupeKey: `subscription.cancelled:${event.subscriptionId}:${event.cancelledAt}`,
        event: 'cancelled',
        recipientUserId: event.fan,
        creatorUserId: event.creator,
        creatorDisplayName: event.creator,
        subscriptionId: event.subscriptionId,
        planId: event.planId,
        occurredAt: new Date(event.timestamp),
      });
    });

    this.eventBus.subscribe('subscription.renewal_failed', (event: SubscriptionRenewalFailedEvent) => {
      void this.notificationsService.enqueueSubscriptionLifecycleNotification({
        dedupeKey: `subscription.renewal_failed:${event.subscriptionId}:${event.timestamp}`,
        event: 'renewal_failed' as any, // Cast as any because we might need to update the NotificationEvent union if it's strict
        recipientUserId: event.fan,
        creatorUserId: event.creator,
        creatorDisplayName: event.creator,
        subscriptionId: event.subscriptionId,
        planId: event.planId,
        occurredAt: new Date(event.timestamp),
      });
    });
  }
}
