import { Test, TestingModule } from '@nestjs/testing';
import { EventBus } from '../events/event-bus';
import { InProcessEventBus } from '../events/in-process-event-bus';
import { SubscriptionCancelledEvent, SubscriptionRenewedEvent } from '../events/domain-events';
import { NotificationsService } from './notifications.service';
import { SubscriptionLifecycleNotifierService } from './subscription-lifecycle-notifier.service';

describe('SubscriptionLifecycleNotifierService', () => {
  let eventBus: InProcessEventBus;
  let notificationsService: {
    enqueueSubscriptionLifecycleNotification: jest.Mock;
  };

  beforeEach(async () => {
    eventBus = new InProcessEventBus();
    notificationsService = {
      enqueueSubscriptionLifecycleNotification: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionLifecycleNotifierService,
        { provide: EventBus, useValue: eventBus },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    module.get(SubscriptionLifecycleNotifierService).onModuleInit();
  });

  it('forwards renewed events to the notifications queue with a stable dedupe key', async () => {
    const event = new SubscriptionRenewedEvent(
      'sub-1',
      'fan-1',
      'creator-1',
      1,
      123456,
      123456,
    );

    eventBus.publish(event);
    await Promise.resolve();

    expect(
      notificationsService.enqueueSubscriptionLifecycleNotification,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        dedupeKey: 'subscription.renewed:sub-1:123456',
        event: 'renewed',
        recipientUserId: 'fan-1',
      }),
    );
  });

  it('forwards cancelled events to the notifications queue with a stable dedupe key', async () => {
    const event = new SubscriptionCancelledEvent(
      'sub-2',
      'fan-2',
      'creator-2',
      3,
      654321,
      654321,
    );

    eventBus.publish(event);
    await Promise.resolve();

    expect(
      notificationsService.enqueueSubscriptionLifecycleNotification,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        dedupeKey: 'subscription.cancelled:sub-2:654321',
        event: 'cancelled',
        recipientUserId: 'fan-2',
      }),
    );
  });
});
