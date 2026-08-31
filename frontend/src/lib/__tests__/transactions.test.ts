import { describe, it, expect } from 'vitest';
import {
  mapPaymentToTransaction,
  mapPaymentsResponse,
  getAnalyticsPaymentsUrl,
  normalizeTransactionStatus,
  normalizeTransactionType,
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

  it('carries backend lifecycle status/type through the mapper', () => {
    const tx = mapPaymentsResponse({
      data: [
        {
          id: 'p3',
          creator: 'C',
          fan: 'F',
          amount: '5',
          fee: '0',
          asset: 'XLM',
          txHash: 'h',
          paidAt: '2026-03-01T00:00:00.000Z',
          status: 'pending',
          type: 'subscription',
        },
      ],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    }).data[0];

    expect(tx.status).toBe('pending');
    expect(tx.type).toBe('subscription');
  });

  describe('normalizeTransactionStatus', () => {
    it('folds backend spellings onto the three UI states', () => {
      expect(normalizeTransactionStatus('confirmed')).toBe('success');
      expect(normalizeTransactionStatus('completed')).toBe('success');
      expect(normalizeTransactionStatus('processing')).toBe('pending');
      expect(normalizeTransactionStatus('rejected')).toBe('failed');
      expect(normalizeTransactionStatus('failed')).toBe('failed');
    });

    it('defaults unknown / missing values to success', () => {
      expect(normalizeTransactionStatus(undefined)).toBe('success');
      expect(normalizeTransactionStatus('weird')).toBe('success');
    });
  });

  describe('normalizeTransactionType', () => {
    it('recognises subscription and refund, else payment', () => {
      expect(normalizeTransactionType('subscription')).toBe('subscription');
      expect(normalizeTransactionType('chargeback')).toBe('refund');
      expect(normalizeTransactionType(undefined)).toBe('payment');
      expect(normalizeTransactionType('tip')).toBe('payment');
    });
  });
});
