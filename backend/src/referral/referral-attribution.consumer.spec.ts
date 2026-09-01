import { Test, TestingModule } from '@nestjs/testing';
import { EventBus } from '../events/event-bus';
import { InProcessEventBus } from '../events/in-process-event-bus';
import {
  SubscriptionCreatedEvent,
  SubscriptionRenewedEvent,
} from '../events/domain-events';
import { ReferralAttributionConsumer } from './referral-attribution.consumer';
import { ReferralService } from './referral.service';

describe('ReferralAttributionConsumer', () => {
  let eventBus: InProcessEventBus;
  let attributeForSubscriber: jest.Mock;

  beforeEach(async () => {
    eventBus = new InProcessEventBus();
    attributeForSubscriber = jest.fn().mockResolvedValue(null);

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralAttributionConsumer,
        { provide: EventBus, useValue: eventBus },
        { provide: ReferralService, useValue: { attributeForSubscriber } },
      ],
    }).compile();

    moduleRef.get(ReferralAttributionConsumer).onModuleInit();
  });

  it('attributes on SubscriptionCreatedEvent using the fan address', () => {
    eventBus.publish(new SubscriptionCreatedEvent('GFAN', 'GCREATOR', 1, 123));

    expect(attributeForSubscriber).toHaveBeenCalledWith('GFAN');
  });

  it('ignores SubscriptionRenewedEvent (renew does not re-pay)', () => {
    eventBus.publish(
      new SubscriptionRenewedEvent('sub-1', 'GFAN', 'GCREATOR', 1, 456),
    );

    expect(attributeForSubscriber).not.toHaveBeenCalled();
  });

  it('does not throw when attribution rejects', async () => {
    attributeForSubscriber.mockRejectedValueOnce(new Error('boom'));

    expect(() =>
      eventBus.publish(
        new SubscriptionCreatedEvent('GFAN', 'GCREATOR', 1, 789),
      ),
    ).not.toThrow();
    await Promise.resolve();
  });
});
