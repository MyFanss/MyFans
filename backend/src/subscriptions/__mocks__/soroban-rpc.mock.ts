import { SubscriptionIndexerEventDto } from '../dto/subscription-indexer-event.dto';

/**
 * Mock RPC stub for the subscribe -> entitlement E2E plan
 * (see docs/entitlement-subscribe-e2e-plan.md).
 *
 * Not wired into any module — for use as a test provider override once
 * the e2e harness is implemented.
 */
export function mockLedgerEvents(): SubscriptionIndexerEventDto[] {
  return [
    {
      event: 'renewed',
      subscriptionId: 'mock-subscription-id',
      userId: 'MOCK_FAN_G_ADDRESS',
      creatorId: 'MOCK_CREATOR_G_ADDRESS',
      planId: 1,
      expiry: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    } as SubscriptionIndexerEventDto,
  ];
}

export class MockSorobanRpcService {
  async getLatestLedgerEvents(): Promise<SubscriptionIndexerEventDto[]> {
    return mockLedgerEvents();
  }
}
