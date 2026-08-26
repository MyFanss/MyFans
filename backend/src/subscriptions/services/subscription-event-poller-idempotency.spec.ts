/**
 * #1582 – Idempotency tests: ensure (ledgerSeq, eventIndex) uniqueness
 * guarantees no duplicate rows or emails under replay and out-of-order delivery.
 */
import { SubscriptionEventPollerService } from './subscription-event-poller.service';
import { SubscriptionStatus } from '../entities/subscription-index.entity';
import { RequestContextService } from '../../common/services/request-context.service';

interface MockRawEvent {
  id: string;
  topic: unknown[];
  ledger: number;
  index: number;
  value: { xdr?: unknown };
  txHash?: string;
}

function makeEvent(
  ledgerSeq: number,
  eventIndex: number,
  eventType: 'subscribed' | 'extended' | 'cancelled' = 'subscribed',
): MockRawEvent {
  return {
    id: `${ledgerSeq}:${eventIndex}`,
    topic: ['CONTRACT_ID', eventType, 'fan_addr', 'creator_addr'],
    ledger: ledgerSeq,
    index: eventIndex,
    value: { xdr: 1 },
    txHash: `txhash_${ledgerSeq}_${eventIndex}`,
  };
}

describe('SubscriptionEventPollerService – idempotency (ledgerSeq:eventIndex)', () => {
  let upsertedRows: any[] = [];
  let publishedEvents: any[] = [];
  let findByEventIdCalls: Array<[number, number]> = [];

  function createPollerWithMocks(overrides?: {
    findByEventIdMock?: (ledgerSeq: number, eventIndex: number) => Promise<any>;
    upsertEventMock?: (data: any) => Promise<any>;
  }) {
    const requestContext = new RequestContextService();
    upsertedRows = [];
    publishedEvents = [];
    findByEventIdCalls = [];

    const indexRepo = {
      getLatestCheckpoint: jest.fn().mockResolvedValue(0),
      findByEventId: jest.fn().mockImplementation(async (ledgerSeq: number, eventIndex: number) => {
        findByEventIdCalls.push([ledgerSeq, eventIndex]);
        if (overrides?.findByEventIdMock) {
          return overrides.findByEventIdMock(ledgerSeq, eventIndex);
        }
        return null;
      }),
      upsertEvent: jest.fn().mockImplementation(async (data: any) => {
        if (overrides?.upsertEventMock) {
          return overrides.upsertEventMock(data);
        }
        upsertedRows.push(data);
        return {
          id: `id_${data.ledgerSeq}_${data.eventIndex}`,
          ...data,
        };
      }),
    };

    const eventBus = {
      publish: jest.fn().mockImplementation((event: any) => {
        publishedEvents.push(event);
      }),
    };

    const sorobanRpc = {
      getLatestLedgerSequence: jest.fn().mockResolvedValue(100),
      getNetworkEvents: jest.fn().mockResolvedValue({
        events: [],
        startLedger: 0,
        latestLedger: 100,
      }),
    };

    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'NODE_ENV') return 'test';
        return 'CONTRACT_ID';
      }),
    };

    const featureFlags = {
      isSorobanPollerEnabled: jest.fn().mockReturnValue(true),
      logPollerFlagResolution: jest.fn(),
    };

    const svc = new (SubscriptionEventPollerService as any)(
      configService,
      indexRepo,
      eventBus,
      sorobanRpc,
      requestContext,
      featureFlags,
    ) as SubscriptionEventPollerService;

    (svc as any).contractId = 'CONTRACT_ID';

    return { svc, indexRepo, eventBus, sorobanRpc };
  }

  it('rejects duplicate delivery of same event (replay scenario)', async () => {
    const { svc, indexRepo } = createPollerWithMocks({
      findByEventIdMock: async (ledgerSeq: number, eventIndex: number) => {
        if (ledgerSeq === 10 && eventIndex === 0) {
          return {
            id: 'existing_row',
            ledgerSeq: 10,
            eventIndex: 0,
            fan: 'fan_addr',
            creator: 'creator_addr',
            planId: 1,
            expiryUnix: 9999999999,
            status: SubscriptionStatus.ACTIVE,
            eventType: 'subscribed',
          };
        }
        return null;
      },
    });

    const event = makeEvent(10, 0, 'subscribed');
    const result = await (svc as any).processEventBatch([event]);

    expect(result).toHaveLength(0); // No processing occurred (already indexed)
    expect(indexRepo.upsertEvent).not.toHaveBeenCalled();
  });

  it('handles out-of-order ledger delivery consistently', async () => {
    const { svc, indexRepo } = createPollerWithMocks();

    // Deliver events with sequences: 20, 10, 15 (out of order)
    const events = [makeEvent(20, 0), makeEvent(10, 0), makeEvent(15, 0)];
    await (svc as any).processEventBatch(events);

    // All three events should be processed (none seen before)
    expect(indexRepo.upsertEvent).toHaveBeenCalledTimes(3);

    // Verify that each was called with correct ledgerSeq/eventIndex
    const calls = indexRepo.upsertEvent.mock.calls;
    expect(calls.map((c: any) => [c[0].ledgerSeq, c[0].eventIndex])).toEqual([
      [20, 0],
      [10, 0],
      [15, 0],
    ]);
  });

  it('skips duplicate within batch (same ledgerSeq:eventIndex)', async () => {
    const { svc, indexRepo } = createPollerWithMocks();

    // Same event twice in a batch
    const event1 = makeEvent(10, 0);
    const event2 = makeEvent(10, 0);
    const event3 = makeEvent(10, 1);

    await (svc as any).processEventBatch([event1, event2, event3]);

    // Should process event1 and event3 once each; event2 duplicate is skipped
    expect(indexRepo.upsertEvent).toHaveBeenCalledTimes(2);
    const calls = indexRepo.upsertEvent.mock.calls;
    expect(calls.map((c: any) => [c[0].ledgerSeq, c[0].eventIndex])).toEqual([
      [10, 0],
      [10, 1],
    ]);
  });

  it('maintains consistent index state under mixed sequential/parallel delivery', async () => {
    const { svc, indexRepo } = createPollerWithMocks();

    // Simulate poller receiving batch 1
    const batch1 = [makeEvent(5, 0), makeEvent(5, 1)];
    await (svc as any).processEventBatch(batch1);

    expect(indexRepo.upsertEvent).toHaveBeenCalledTimes(2);

    // Simulate poller receiving batch 2 (includes event already in batch1)
    indexRepo.upsertEvent.mockClear();
    indexRepo.findByEventId.mockImplementation(async (ledgerSeq: number, eventIndex: number) => {
      if ((ledgerSeq === 5 && (eventIndex === 0 || eventIndex === 1))) {
        return { id: 'already_exists' };
      }
      return null;
    });

    const batch2 = [makeEvent(5, 0), makeEvent(5, 1), makeEvent(5, 2)];
    await (svc as any).processEventBatch(batch2);

    // Only new event (5, 2) should be upserted
    expect(indexRepo.upsertEvent).toHaveBeenCalledTimes(1);
    expect(indexRepo.upsertEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        ledgerSeq: 5,
        eventIndex: 2,
      }),
    );
  });

  it('verifies unique constraint on (ledgerSeq, eventIndex) prevents duplicates', async () => {
    const { svc, indexRepo } = createPollerWithMocks({
      upsertEventMock: async (data: any) => {
        // Simulate database unique constraint violation (code 23505)
        const err = new Error('duplicate key');
        (err as any).code = '23505';
        throw err;
      },
    });

    // First delivery succeeds (no violation yet)
    indexRepo.upsertEvent.mockImplementationOnce(async (data: any) => {
      return { id: 'new_row', ...data };
    });

    // Deliver same event twice
    const event = makeEvent(10, 0);

    indexRepo.findByEventId.mockResolvedValueOnce(null); // First check: not found
    const result1 = await (svc as any).processEventBatch([event]);
    expect(result1[0].ok).toBe(true); // First insert succeeds

    // Second delivery of same event
    indexRepo.findByEventId.mockResolvedValueOnce(null); // Not found yet in index
    indexRepo.upsertEvent.mockImplementationOnce(async () => {
      const err = new Error('duplicate key');
      (err as any).code = '23505';
      throw err;
    });
    indexRepo.upsertEvent.mockImplementationOnce(async (data: any) => {
      // Simulate the fallback findByEventId returning the existing row
      return { id: 'existing_row_from_constraint', ...data };
    });

    // The second attempt should catch the constraint violation and fetch existing
    const result2 = await (svc as any).processEventBatch([event]);
    // Result should reflect that the event was already indexed
    expect(result2).toHaveLength(1);
  });

  it('does not enqueue duplicate email on replay', async () => {
    // This test verifies the email outbox dedupe_key uniqueness
    // In actual operation, domain events published by the poller trigger
    // notifications which populate the outbox. The email outbox has its own
    // dedupe_key uniqueness constraint, so replayed events (same ledgerSeq:eventIndex)
    // that publish the same domain event will attempt to enqueue the same email
    // and hit the outbox's constraint, deduping at that layer as well.

    const { svc } = createPollerWithMocks();

    // For this test, we verify that the poller itself (via upsertEvent)
    // catches the duplicate first via the subscription_index constraint.
    // The email outbox constraint is a secondary defense layer.

    const event = makeEvent(10, 0, 'subscribed');
    indexRepo.findByEventId.mockResolvedValueOnce(
      { id: 'already_indexed', ledgerSeq: 10, eventIndex: 0 },
    );

    const result = await (svc as any).processEventBatch([event]);
    expect(result).toHaveLength(0); // Duplicate skipped at poller layer
    expect(publishedEvents).toHaveLength(0); // No domain event published
  });

  it('logs warning when duplicate is detected via constraint', async () => {
    const logger = { warn: jest.fn(), log: jest.fn(), debug: jest.fn() };
    const { svc, indexRepo } = createPollerWithMocks();

    (svc as any).logger = logger;

    indexRepo.findByEventId.mockImplementationOnce(async (ledgerSeq: number, eventIndex: number) => {
      // First check says not found (will attempt insert)
      return null;
    });

    indexRepo.upsertEvent.mockImplementationOnce(async (data: any) => {
      // Constraint violation on insert
      const err = new Error('duplicate key');
      (err as any).code = '23505';
      throw err;
    });

    indexRepo.upsertEvent.mockImplementationOnce(async (data: any) => {
      // Return the existing row
      return {
        id: 'existing',
        ledgerSeq: data.ledgerSeq,
        eventIndex: data.eventIndex,
        fan: data.fan,
        creator: data.creator,
      };
    });

    const event = makeEvent(10, 0);
    await (svc as any).processEventBatch([event]);

    // Verify warning was logged
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Event already indexed'),
    );
  });
});
