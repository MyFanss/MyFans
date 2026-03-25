import { Test, TestingModule } from '@nestjs/testing';
import { InProcessEventBus } from './in-process-event-bus';
import { EventBus } from './event-bus';
import { AuthService } from '../auth/auth.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { CreatorsService } from '../creators/creators.service';
import {
  UserLoggedInEvent,
  SubscriptionCreatedEvent,
  SubscriptionExpiredEvent,
  PlanCreatedEvent,
} from './domain-events';

describe('InProcessEventBus', () => {
  let eventBus: InProcessEventBus;

  beforeEach(() => {
    eventBus = new InProcessEventBus();
  });

  it('delivers event to subscriber', () => {
    const handler = jest.fn();
    eventBus.subscribe('auth.user_logged_in', handler);
    const event = new UserLoggedInEvent('user1', 'GABC123');
    eventBus.publish(event);
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('delivers to multiple subscribers', () => {
    const h1 = jest.fn();
    const h2 = jest.fn();
    eventBus.subscribe('subscription.created', h1);
    eventBus.subscribe('subscription.created', h2);
    const event = new SubscriptionCreatedEvent('fan1', 'creator1', 1, 9999);
    eventBus.publish(event);
    expect(h1).toHaveBeenCalledWith(event);
    expect(h2).toHaveBeenCalledWith(event);
  });

  it('does not deliver to wrong event type subscriber', () => {
    const handler = jest.fn();
    eventBus.subscribe('subscription.created', handler);
    eventBus.publish(new UserLoggedInEvent('user1', 'GABC123'));
    expect(handler).not.toHaveBeenCalled();
  });

  it('continues publishing if one handler throws', () => {
    const badHandler = jest.fn().mockImplementation(() => { throw new Error('boom'); });
    const goodHandler = jest.fn();
    eventBus.subscribe('auth.user_logged_in', badHandler);
    eventBus.subscribe('auth.user_logged_in', goodHandler);
    eventBus.publish(new UserLoggedInEvent('user1', 'GABC123'));
    expect(goodHandler).toHaveBeenCalled();
  });
});

describe('AuthService events', () => {
  let authService: AuthService;
  let eventBus: InProcessEventBus;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: EventBus, useClass: InProcessEventBus },
      ],
    }).compile();

    authService = module.get(AuthService);
    eventBus = module.get(EventBus);
  });

  it('publishes UserLoggedInEvent on createSession', async () => {
    const handler = jest.fn();
    eventBus.subscribe('auth.user_logged_in', handler);
    await authService.createSession('GABC1234567890123456789012345678901234567890123456');
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'auth.user_logged_in' }),
    );
  });
});

describe('SubscriptionsService events', () => {
  let subscriptionsService: SubscriptionsService;
  let eventBus: InProcessEventBus;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        { provide: EventBus, useClass: InProcessEventBus },
      ],
    }).compile();

    subscriptionsService = module.get(SubscriptionsService);
    eventBus = module.get(EventBus);
  });

  it('publishes SubscriptionCreatedEvent on addSubscription', () => {
    const handler = jest.fn();
    eventBus.subscribe('subscription.created', handler);
    subscriptionsService.addSubscription('fan1', 'creator1', 1, 9999999);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'subscription.created',
        fan: 'fan1',
        creator: 'creator1',
        planId: 1,
      }),
    );
  });

  it('publishes SubscriptionExpiredEvent on expireSubscription', () => {
    const handler = jest.fn();
    eventBus.subscribe('subscription.expired', handler);
    subscriptionsService.expireSubscription('fan1', 'creator1');
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'subscription.expired',
        fan: 'fan1',
        creator: 'creator1',
      }),
    );
  });
});

describe('CreatorsService events', () => {
  let creatorsService: CreatorsService;
  let eventBus: InProcessEventBus;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatorsService,
        { provide: EventBus, useClass: InProcessEventBus },
      ],
    }).compile();

    creatorsService = module.get(CreatorsService);
    eventBus = module.get(EventBus);
  });

  it('publishes PlanCreatedEvent on createPlan', () => {
    const handler = jest.fn();
    eventBus.subscribe('creator.plan_created', handler);
    creatorsService.createPlan('creator1', 'USDC', '10', 30);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'creator.plan_created',
        creator: 'creator1',
        asset: 'USDC',
        amount: '10',
      }),
    );
  });
});
