import { AnalyticsService } from './analytics.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { CheckoutStatus } from '../subscriptions/subscriptions.service';

const CREATOR_A = 'GCREATOR_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const CREATOR_B = 'GCREATOR_BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
const FAN = 'GFAN111111111111111111111111111111111111111111111111111111';

function makePayment(overrides: Partial<{
  id: string; creatorAddress: string; fanAddress: string;
  amount: string; fee: string; assetCode: string;
  txHash: string; updatedAt: Date; status: CheckoutStatus;
}> = {}) {
  return {
    id: overrides.id ?? 'pay-1',
    creatorAddress: overrides.creatorAddress ?? CREATOR_A,
    fanAddress: overrides.fanAddress ?? FAN,
    amount: overrides.amount ?? '10.0000000',
    fee: overrides.fee ?? '0.5000000',
    assetCode: overrides.assetCode ?? 'XLM',
    txHash: overrides.txHash ?? 'tx_abc',
    updatedAt: overrides.updatedAt ?? new Date('2025-06-15T12:00:00Z'),
    status: overrides.status ?? CheckoutStatus.COMPLETED,
  };
}

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let mockGetCompleted: jest.Mock;

  beforeEach(() => {
    mockGetCompleted = jest.fn();
    const mockSubs = { getCompletedPayments: mockGetCompleted } as unknown as SubscriptionsService;
    service = new AnalyticsService(mockSubs);
  });

  // ── getPayments ──────────────────────────────────────────────────────────

  describe('getPayments', () => {
    it('returns all payments when no filters', () => {
      mockGetCompleted.mockReturnValue([makePayment(), makePayment({ id: 'pay-2' })]);
      const result = service.getPayments({});
      expect(result.total).toBe(2);
      expect(result.data).toHaveLength(2);
    });

    it('filters by creator', () => {
      mockGetCompleted.mockReturnValue([
        makePayment({ id: 'p1', creatorAddress: CREATOR_A }),
        makePayment({ id: 'p2', creatorAddress: CREATOR_B }),
      ]);
      const result = service.getPayments({ creator: CREATOR_A });
      expect(result.total).toBe(1);
      expect(result.data[0].creator).toBe(CREATOR_A);
    });

    it('filters by date range', () => {
      mockGetCompleted.mockReturnValue([
        makePayment({ id: 'p1', updatedAt: new Date('2025-03-01') }),
        makePayment({ id: 'p2', updatedAt: new Date('2025-07-01') }),
        makePayment({ id: 'p3', updatedAt: new Date('2025-11-01') }),
      ]);
      const result = service.getPayments({ from: '2025-05-01', to: '2025-09-01' });
      expect(result.total).toBe(1);
      expect(result.data[0].id).toBe('p2');
    });

    it('paginates correctly', () => {
      mockGetCompleted.mockReturnValue(
        Array.from({ length: 25 }, (_, i) => makePayment({ id: `p${i}` })),
      );
      const page1 = service.getPayments({ page: 1, limit: 10 });
      const page2 = service.getPayments({ page: 2, limit: 10 });
      expect(page1.data).toHaveLength(10);
      expect(page2.data).toHaveLength(10);
      expect(page1.totalPages).toBe(3);
    });

    it('returns empty result when no payments', () => {
      mockGetCompleted.mockReturnValue([]);
      const result = service.getPayments({});
      expect(result.total).toBe(0);
      expect(result.data).toHaveLength(0);
    });
  });

  // ── getEarnings ──────────────────────────────────────────────────────────

  describe('getEarnings', () => {
    it('aggregates gross, fees, and net per creator', () => {
      mockGetCompleted.mockReturnValue([
        makePayment({ id: 'p1', creatorAddress: CREATOR_A, amount: '10.0000000', fee: '0.5000000' }),
        makePayment({ id: 'p2', creatorAddress: CREATOR_A, amount: '20.0000000', fee: '1.0000000' }),
      ]);
      const result = service.getEarnings({});
      expect(result.total).toBe(1);
      const summary = result.data[0];
      expect(summary.totalGross).toBe('30.0000000');
      expect(summary.totalFees).toBe('1.5000000');
      expect(summary.totalNet).toBe('28.5000000');
      expect(summary.paymentCount).toBe(2);
    });

    it('groups separately by creator', () => {
      mockGetCompleted.mockReturnValue([
        makePayment({ id: 'p1', creatorAddress: CREATOR_A }),
        makePayment({ id: 'p2', creatorAddress: CREATOR_B }),
      ]);
      const result = service.getEarnings({});
      expect(result.total).toBe(2);
    });

    it('filters by creator', () => {
      mockGetCompleted.mockReturnValue([
        makePayment({ id: 'p1', creatorAddress: CREATOR_A }),
        makePayment({ id: 'p2', creatorAddress: CREATOR_B }),
      ]);
      const result = service.getEarnings({ creator: CREATOR_B });
      expect(result.total).toBe(1);
      expect(result.data[0].creator).toBe(CREATOR_B);
    });

    it('filters by date range', () => {
      mockGetCompleted.mockReturnValue([
        makePayment({ id: 'p1', updatedAt: new Date('2025-01-01') }),
        makePayment({ id: 'p2', updatedAt: new Date('2025-06-01') }),
      ]);
      const result = service.getEarnings({ from: '2025-05-01' });
      expect(result.total).toBe(1);
    });

    it('paginates earnings summaries', () => {
      // 5 distinct creators
      mockGetCompleted.mockReturnValue(
        Array.from({ length: 5 }, (_, i) =>
          makePayment({ id: `p${i}`, creatorAddress: `GCREATOR${i}${'A'.repeat(49 - i)}` }),
        ),
      );
      const result = service.getEarnings({ page: 1, limit: 3 });
      expect(result.data).toHaveLength(3);
      expect(result.totalPages).toBe(2);
    });
  });
});
