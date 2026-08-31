import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventBus } from '../events/event-bus';
import {
  SubscriptionCreatedEvent,
  SubscriptionCancelledEvent,
  SubscriptionRenewedEvent,
  SubscriptionRenewalFailedEvent,
} from '../events/domain-events';
import { NotificationsService } from './notifications.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class SubscriptionLifecycleNotifierService implements OnModuleInit {
  private readonly logger = new Logger(SubscriptionLifecycleNotifierService.name);

  constructor(
    private readonly eventBus: EventBus,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
  ) { }

  onModuleInit(): void {
    this.eventBus.subscribe('subscription.created', (event: SubscriptionCreatedEvent) => {
      const subscriptionId = `${event.fan}:${event.creator}:${event.planId}`;
      void this.notificationsService.enqueueSubscriptionLifecycleNotification({
        dedupeKey: `subscription.created:${subscriptionId}:${event.expiry}`,
        event: 'created',
        recipientUserId: event.fan,
        creatorUserId: event.creator,
        creatorDisplayName: event.creator,
        subscriptionId,
        planId: event.planId,
        occurredAt: new Date(event.timestamp),
      });
    });

    this.eventBus.subscribe('subscription.renewed', (event: SubscriptionRenewedEvent) => {
      void this.handleLifecycleEvent('renewed', event, `subscription.renewed:${event.subscriptionId}:${event.expiry}`);
    });

    this.eventBus.subscribe('subscription.cancelled', (event: SubscriptionCancelledEvent) => {
      void this.handleLifecycleEvent('cancelled', event, `subscription.cancelled:${event.subscriptionId}:${event.cancelledAt}`);
    });

    this.eventBus.subscribe('subscription.renewal_failed', (event: SubscriptionRenewalFailedEvent) => {
      void this.handleLifecycleEvent('renewal_failed', event, `subscription.renewal_failed:${event.subscriptionId}:${event.timestamp}`);
    });
  }

  /**
   * Resolves `event.fan` (a Stellar G-address) to a platform user UUID
   * before handing off to the notifications service — `EmailOutboxService`
   * / `NotificationsService.enqueueSubscriptionLifecycleNotification`
   * expect `recipientUserId` to be a platform user id, never a raw address.
   *
   * When the fan has no linked platform account yet (currently always, see
   * `UsersService#findByStellarAddress`), the notification is skipped
   * rather than crashing or leaking the G-address into `toUserId` /
   * `user_id` columns. This is logged so unlinked-fan volume is visible.
   */
  private async handleLifecycleEvent(
    eventName: 'renewed' | 'cancelled' | 'renewal_failed',
    event: SubscriptionRenewedEvent | SubscriptionCancelledEvent | SubscriptionRenewalFailedEvent,
    dedupeKey: string,
  ): Promise<void> {
    const recipient = await this.usersService.findByStellarAddress(event.fan);
    if (!recipient) {
      this.logger.warn(
        `Skipping subscription.${eventName} notification for unlinked fan address ${event.fan} (subscription ${event.subscriptionId})`,
      );
      return;
    }

    await this.notificationsService.enqueueSubscriptionLifecycleNotification({
      dedupeKey,
      event: eventName,
      recipientUserId: recipient.id,
      creatorUserId: event.creator,
      creatorDisplayName: event.creator,
      subscriptionId: event.subscriptionId,
      planId: event.planId,
      occurredAt: new Date(event.timestamp),
    });
  }
}
