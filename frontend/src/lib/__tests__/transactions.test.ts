import { describe, it, expect } from 'vitest';
import {
  mapPaymentToTransaction,
  mapPaymentsResponse,
  getAnalyticsPaymentsUrl,
} from '../transactions';

describe('transactions helpers', () => {
  it('maps backend payment records to UI transactions', () => {
    const tx = mapPaymentToTransaction({
      id: 'pay-1',
      creator: 'GCREATOR',
      fan: 'GFAN',
      amount: '12.5',
      fee: '0.1',
      asset: 'XLM',
      txHash: 'abc123',
      paidAt: '2026-01-15T12:00:00.000Z',
    });

    expect(tx).toEqual({
      id: 'pay-1',
      type: 'payment',
      status: 'success',
      amount: 12.5,
      currency: 'XLM',
      txHash: 'abc123',
      createdAt: '2026-01-15T12:00:00.000Z',
    });
  });

  it('maps paginated backend payloads and tolerates empty data', () => {
    const empty = mapPaymentsResponse({ data: [], total: 0, page: 1, limit: 10, totalPages: 1 });
    expect(empty.data).toEqual([]);
    expect(empty.totalPages).toBe(1);

    const mapped = mapPaymentsResponse({
      data: [
        {
          id: 'p2',
          creator: 'C',
          fan: 'F',
          amount: '3',
          fee: '0',
          asset: 'USDC',
          txHash: '',
          paidAt: '2026-02-01T00:00:00.000Z',
        },
      ],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    });

    expect(mapped.data).toHaveLength(1);
    expect(mapped.data[0].currency).toBe('USDC');
    expect(mapped.data[0].txHash).toBeUndefined();
  });

  it('builds an absolute analytics payments URL', () => {
    expect(getAnalyticsPaymentsUrl()).toMatch(/\/v1\/analytics\/payments$/);
  });
});
