import { Test, TestingModule } from '@nestjs/testing';
import { EventBus } from '../events/event-bus';
import { InProcessEventBus } from '../events/in-process-event-bus';
import { SubscriptionChainReaderService } from './subscription-chain-reader.service';
import { SubscriptionsService } from './subscriptions.service';
import {
  SUBSCRIPTION_EVENT_PUBLISHER,
  SUBSCRIPTION_RENEWAL_FAILED,
  SubscriptionEventPublisher,
} from './events';
import { SubscriptionIndexRepository } from './repositories/subscription-index.repository';
import {
  SubscriptionIndexEntity,
  SubscriptionStatus,
} from './entities/subscription-index.entity';

function makeChainReader(): SubscriptionChainReaderService {
  return {
    getConfiguredContractId: jest.fn().mockReturnValue(undefined),
    readIsSubscriber: jest.fn(),
  } as unknown as SubscriptionChainReaderService;
}

function makeSub(
  overrides: Partial<SubscriptionIndexEntity> = {},
): SubscriptionIndexEntity {
  return {
    id: 'sub-1',
    fan: 'GFAN1111111111111111111111111111111111111111111111111111',
    creator: 'GAAAAAAAAAAAAAAA',
    planId: 1,
    expiryUnix: Math.floor(Date.now() / 1000) + 3600,
    createdAt: new Date(),
    updatedAt: new Date(),
    indexedAt: new Date(),
    status: SubscriptionStatus.ACTIVE,
    ledgerSeq: -1,
    eventIndex: -1,
    eventType: 'manual',
    ...overrides,
  };
}

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let eventPublisher: jest.Mocked<SubscriptionEventPublisher>;
  let eventBus: InProcessEventBus;
  let repo: jest.Mocked<SubscriptionIndexRepository>;
  let currentSubs: SubscriptionIndexEntity[];

  beforeEach(async () => {
    currentSubs = [];
    eventPublisher = { emit: jest.fn() };
    eventBus = new InProcessEventBus();
    repo = {
      upsertManual: jest.fn(async (data) => {
        const existingIndex = currentSubs.findIndex(
          (sub) => sub.fan === data.fan && sub.creator === data.creator,
        );
        const next = makeSub({
          id: existingIndex >= 0 ? currentSubs[existingIndex].id : `sub-${currentSubs.length + 1}`,
          fan: data.fan,
          creator: data.creator,
          planId: data.planId,
          expiryUnix: data.expiryUnix,
          status: data.status,
        });
        if (existingIndex >= 0) {
          currentSubs[existingIndex] = next;
        } else {
          currentSubs.push(next);
        }
        return next;
      }),
      findCurrentForFanCreator: jest.fn(async (fan, creator) =>
        currentSubs.find((sub) => sub.fan === fan && sub.creator === creator) ?? null,
      ),
      isSubscriber: jest.fn(async (fan, creator) => {
        const sub = currentSubs.find(
          (entry) => entry.fan === fan && entry.creator === creator,
        );
        return !!sub && sub.status === SubscriptionStatus.ACTIVE;
      }),
      findAndCountForFan: jest.fn(async (fan, status, _sort, page, limit) => {
        const filtered = currentSubs.filter(
          (sub) => sub.fan === fan && (status ? sub.status === status : true),
        );
        const start = (page - 1) * limit;
        return [filtered.slice(start, start + limit), filtered.length];
      }),
      listForCreator: jest.fn(async (creator) =>
        currentSubs.filter((sub) => sub.creator === creator),
      ),
      listActiveForFan: jest.fn(async (fan) =>
        currentSubs.filter(
          (sub) => sub.fan === fan && sub.status === SubscriptionStatus.ACTIVE,
        ),
      ),
      updateStatus: jest.fn(async (fan, creator, status, expiryUnix) => {
        const sub = currentSubs.find(
          (entry) => entry.fan === fan && entry.creator === creator,
        );
        if (sub) {
          sub.status = status;
          sub.expiryUnix = expiryUnix ?? sub.expiryUnix;
        }
      }),
      findAllForReconciler: jest.fn(async () => currentSubs),
      findWithCursor: jest.fn(async (fan, status, sort, cursorId, limit) => {
        let filtered = currentSubs.filter(
          (sub) => sub.fan === fan && (status ? sub.status === status : true),
        );
        if (cursorId) {
          filtered = filtered.filter((sub) => sub.id > cursorId);
        }
        return filtered.slice(0, limit + 1);
      }),
    } as unknown as jest.Mocked<SubscriptionIndexRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        { provide: EventBus, useValue: eventBus },
        { provide: SubscriptionChainReaderService, useValue: makeChainReader() },
        { provide: SUBSCRIPTION_EVENT_PUBLISHER, useValue: eventPublisher },
        { provide: SubscriptionIndexRepository, useValue: repo },
      ],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
  });

  it('emits renewal_failed event when checkout failure is recorded', async () => {
    const checkout = service.createCheckout(
      'GFANADDRESS111111111111111111111111111111111111111111111111',
      'GAAAAAAAAAAAAAAA',
      1,
    );

    service.failCheckout(checkout.id, 'insufficient funds');
    await Promise.resolve();

    expect(eventPublisher.emit).toHaveBeenCalledWith(
      SUBSCRIPTION_RENEWAL_FAILED,
      expect.objectContaining({
        subscriptionId: checkout.id,
        reason: 'insufficient funds',
        userId: checkout.fanAddress,
      }),
    );
  });

  it('lists subscriptions from the repository', async () => {
    await service.addSubscription(
      'GFANADDRESS333333333333333333333333333333333333333333333333',
      'GAAAAAAAAAAAAAAA',
      1,
      Math.floor(Date.now() / 1000) + 60,
    );

    const result = await service.listSubscriptions(
      'GFANADDRESS333333333333333333333333333333333333333333333333',
    );

    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(repo.findWithCursor).toHaveBeenCalledWith(
      'GFANADDRESS333333333333333333333333333333333333333333333333',
      undefined,
      undefined,
      undefined,
      20,
    );
  });

  it('passes status and cursor to findWithCursor', async () => {
    await service.addSubscription(
      'GFANADDRESS666666666666666666666666666666666666666666666666',
      'GAAAAAAAAAAAAAAA',
      1,
      Math.floor(Date.now() / 1000) + 60,
    );

    await service.listSubscriptions(
      'GFANADDRESS666666666666666666666666666666666666666666666666',
      SubscriptionStatus.ACTIVE,
      'created',
      'some-cursor',
      10,
    );

    expect(repo.findWithCursor).toHaveBeenCalledWith(
      'GFANADDRESS666666666666666666666666666666666666666666666666',
      SubscriptionStatus.ACTIVE,
      'created',
      'some-cursor',
      10,
    );
  });

  it('filters by status=active via findWithCursor', async () => {
    const fan = 'GFANADDRESS777777777777777777777777777777777777777777777777';
    await service.addSubscription(fan, 'GAAAAAAAAAAAAAAA', 1, Math.floor(Date.now() / 1000) + 3600);

    await service.listSubscriptions(fan, SubscriptionStatus.ACTIVE, undefined, undefined, 20);

    expect(repo.findWithCursor).toHaveBeenCalledWith(fan, SubscriptionStatus.ACTIVE, undefined, undefined, 20);
  });

  it('filters by status=expired via findWithCursor', async () => {
    const fan = 'GFANADDRESS888888888888888888888888888888888888888888888888';
    await service.addSubscription(fan, 'GAAAAAAAAAAAAAAA', 1, Math.floor(Date.now() / 1000) - 3600);

    await service.listSubscriptions(fan, SubscriptionStatus.EXPIRED, undefined, undefined, 20);

    expect(repo.findWithCursor).toHaveBeenCalledWith(fan, SubscriptionStatus.EXPIRED, undefined, undefined, 20);
  });

  it('passes sort=expiry to findWithCursor', async () => {
    const fan = 'GFANADDRESS999999999999999999999999999999999999999999999999';
    await service.listSubscriptions(fan, undefined, 'expiry', undefined, 20);

    expect(repo.findWithCursor).toHaveBeenCalledWith(fan, undefined, 'expiry', undefined, 20);
  });

  it('listCreatorSubscribers sorts by expiry when sort=expiry', async () => {
    const creator = 'GCREATOR1111111111111111111111111111111111111111111111111111';
    const now = Math.floor(Date.now() / 1000);
    currentSubs.push(
      makeSub({ id: 'sub-a', fan: 'GFAN_A', creator, expiryUnix: now + 7200, createdAt: new Date(Date.now() - 1000) }),
      makeSub({ id: 'sub-b', fan: 'GFAN_B', creator, expiryUnix: now + 3600, createdAt: new Date() }),
    );

    const result = await service.listCreatorSubscribers(creator, undefined, undefined, 20, 'expiry');

    expect(result.data[0].fanAddress).toBe('GFAN_B'); // earlier expiry first
    expect(result.data[1].fanAddress).toBe('GFAN_A');
  });

  it('listCreatorSubscribers sorts by created desc by default', async () => {
    const creator = 'GCREATOR2222222222222222222222222222222222222222222222222222';
    const now = Math.floor(Date.now() / 1000);
    currentSubs.push(
      makeSub({ id: 'sub-c', fan: 'GFAN_C', creator, expiryUnix: now + 3600, createdAt: new Date(Date.now() - 5000) }),
      makeSub({ id: 'sub-d', fan: 'GFAN_D', creator, expiryUnix: now + 3600, createdAt: new Date() }),
    );

    const result = await service.listCreatorSubscribers(creator, undefined, undefined, 20);

    expect(result.data[0].fanAddress).toBe('GFAN_D'); // most recently created first
    expect(result.data[1].fanAddress).toBe('GFAN_C');
  });

  it('listCreatorSubscribers filters by status=active', async () => {
    const creator = 'GCREATOR3333333333333333333333333333333333333333333333333333';
    const now = Math.floor(Date.now() / 1000);
    currentSubs.push(
      makeSub({ id: 'sub-e', fan: 'GFAN_E', creator, expiryUnix: now + 3600, status: SubscriptionStatus.ACTIVE }),
      makeSub({ id: 'sub-f', fan: 'GFAN_F', creator, expiryUnix: now - 3600, status: SubscriptionStatus.EXPIRED }),
    );

    const result = await service.listCreatorSubscribers(creator, 'active', undefined, 20);

    expect(result.data).toHaveLength(1);
    expect(result.data[0].fanAddress).toBe('GFAN_E');
  });

  it('publishes a renewal event when confirming an existing subscription', async () => {
    const handler = jest.fn();
    eventBus.subscribe('subscription.renewed', handler);

    await service.addSubscription(
      'GFANADDRESS444444444444444444444444444444444444444444444444',
      'GAAAAAAAAAAAAAAA',
      1,
      Math.floor(Date.now() / 1000) + 60,
    );

    const checkout = service.createCheckout(
      'GFANADDRESS444444444444444444444444444444444444444444444444',
      'GAAAAAAAAAAAAAAA',
      1,
    );

    const result = await service.confirmSubscription(checkout.id, 'tx-renew');

    expect(result.lifecycleEvent).toBe('renewed');
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'subscription.renewed',
        fan: checkout.fanAddress,
        creator: checkout.creatorAddress,
      }),
    );
  });

  it('publishes a cancelled event when subscription is cancelled', async () => {
    const handler = jest.fn();
    eventBus.subscribe('subscription.cancelled', handler);

    const subscription = await service.addSubscription(
      'GFANADDRESS555555555555555555555555555555555555555555555555',
      'GAAAAAAAAAAAAAAA',
      1,
      Math.floor(Date.now() / 1000) + 60,
    );

    const result = await service.cancelSubscription(
      'GFANADDRESS555555555555555555555555555555555555555555555555',
      'GAAAAAAAAAAAAAAA',
    );

    expect(result.subscriptionId).toBe(subscription.id);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'subscription.cancelled',
        subscriptionId: subscription.id,
      }),
    );
  });
});
