import { RequestContextService } from '../../common/services/request-context.service';
import { SubscriptionEventPollerService } from './subscription-event-poller.service';

/**
 * #592 – Correlation ID: ensure async context propagation
 * Verifies that poll() seeds a fresh correlationId into AsyncLocalStorage
 * so all downstream async calls within the same poll cycle share it.
 */
describe('SubscriptionEventPollerService – correlation ID propagation', () => {
  let requestContext: RequestContextService;
  let capturedIds: string[];

  beforeEach(() => {
    requestContext = new RequestContextService();
    capturedIds = [];
  });

  it('seeds a correlationId into AsyncLocalStorage for each poll cycle', async () => {
    // Minimal stub – only the parts poll() touches
    const service = new (SubscriptionEventPollerService as any)(
      { get: () => 'CONTRACT_ID' },
      {
        getLatestCheckpoint: async () => 0,
        findByEventId: async () => null,
      },
      { publish: () => undefined },
      {
        getLatestLedgerSequence: async () => 0, // no new ledgers → early return
      },
      requestContext,
    ) as SubscriptionEventPollerService;

    // Patch onModuleInit so contractId is set without real config
    (service as any).contractId = 'CONTRACT_ID';

    // Spy: capture the correlationId that is active during _poll
    const origPoll = (service as any)._poll.bind(service);
    (service as any)._poll = async () => {
      capturedIds.push(requestContext.getCorrelationId() ?? '');
      return origPoll();
    };

    await service.poll();
    await service.poll();

    expect(capturedIds).toHaveLength(2);
    // Each cycle gets a unique, non-empty UUID
    expect(capturedIds[0]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(capturedIds[1]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(capturedIds[0]).not.toBe(capturedIds[1]);
  });

  it('clears correlationId after poll() resolves (no context leak)', async () => {
    const service = new (SubscriptionEventPollerService as any)(
      { get: () => 'CONTRACT_ID' },
      { getLatestCheckpoint: async () => 0, findByEventId: async () => null },
      { publish: () => undefined },
      { getLatestLedgerSequence: async () => 0 },
      requestContext,
    ) as SubscriptionEventPollerService;
    (service as any).contractId = 'CONTRACT_ID';

    await service.poll();

    // Outside the run() callback the store is gone
    expect(requestContext.getCorrelationId()).toBeNull();
  });
});
