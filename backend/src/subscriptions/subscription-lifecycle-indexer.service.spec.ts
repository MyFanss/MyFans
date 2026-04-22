import { Test, TestingModule } from '@nestjs/testing';
import { EventBus } from '../events/event-bus';
import { InProcessEventBus } from '../events/in-process-event-bus';
import { SubscriptionLifecycleIndexerService } from './subscription-lifecycle-indexer.service';

describe('SubscriptionLifecycleIndexerService', () => {
  let service: SubscriptionLifecycleIndexerService;
  let eventBus: InProcessEventBus;

  beforeEach(async () => {
    eventBus = new InProcessEventBus();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionLifecycleIndexerService,
        { provide: EventBus, useValue: eventBus },
      ],
    }).compile();

    service = module.get(SubscriptionLifecycleIndexerService);
  });

  it('publishes renewed indexer events onto the event bus', () => {
    const handler = jest.fn();
    eventBus.subscribe('subscription.renewed', handler);

    service.handleEvent({
      event: 'renewed',
      subscriptionId: 'sub-1',
      userId: 'user-1',
      creatorId: 'creator-1',
      planId: 2,
      expiry: 1700000000,
    });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'subscription.renewed',
        subscriptionId: 'sub-1',
        fan: 'user-1',
      }),
    );
  });

  it('publishes cancelled indexer events onto the event bus', () => {
    const handler = jest.fn();
    eventBus.subscribe('subscription.cancelled', handler);

    service.handleEvent({
      event: 'cancelled',
      subscriptionId: 'sub-2',
      userId: 'user-2',
      creatorId: 'creator-2',
      planId: 3,
      cancelledAt: 1700000001,
    });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'subscription.cancelled',
        subscriptionId: 'sub-2',
        fan: 'user-2',
      }),
    );
  });
});
