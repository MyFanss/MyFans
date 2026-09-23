import { Injectable } from '@nestjs/common';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { PaymentAnalyticsQueryDto } from './dto/payment-analytics-query.dto';

export interface PaymentRecord {
  id: string;
  creator: string;
  fan: string;
  amount: string;
  fee: string;
  asset: string;
  txHash: string;
  paidAt: string;
}

export interface EarningsSummary {
  creator: string;
  totalGross: string;
  totalFees: string;
  totalNet: string;
  paymentCount: number;
  asset: string;
}

/**
 * Distinguishes a first-time subscription from a renewal so analytics can
 * report MRR correctly (only renewals contribute to recurring revenue).
 */
export enum SubscriptionEventType {
  Created = 'subscription.created',
  Renewed = 'subscription.renewed',
}

export interface SubscriptionAnalyticsEvent {
  type: SubscriptionEventType;
  subscriptionId: string;
  creator: string;
  fan: string;
  asset: string;
  amount: string;
  occurredAt: string;
}

export interface MrrSummary {
  creator: string;
  asset: string;
  mrr: string;
  activeSubscriptions: number;
  newSubscriptions: number;
  renewals: number;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  getPayments(query: PaymentAnalyticsQueryDto): PaginatedResponseDto<PaymentRecord> {
    const { creator, from, to, page = 1, limit = 20 } = query;
    const fromMs = from ? new Date(from).getTime() : 0;
    const toMs = to ? new Date(to).getTime() : Infinity;

    let payments = this.subscriptionsService
      .getCompletedPayments()
      .filter((c) => {
        const t = new Date(c.updatedAt).getTime();
        return (
          (!creator || c.creatorAddress === creator) &&
          t >= fromMs &&
          t <= toMs
        );
      })
      .map<PaymentRecord>((c) => ({
        id: c.id,
        creator: c.creatorAddress,
        fan: c.fanAddress,
        amount: c.amount,
        fee: c.fee,
        asset: c.assetCode,
        txHash: c.txHash ?? '',
        paidAt: c.updatedAt.toISOString(),
      }));

    // newest first
    payments.sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());

    const total = payments.length;
    const data = payments.slice((page - 1) * limit, page * limit);
    return new PaginatedResponseDto(data, total, page, limit);
  }

  getEarnings(query: PaymentAnalyticsQueryDto): PaginatedResponseDto<EarningsSummary> {
    const { creator, from, to, page = 1, limit = 20 } = query;
    const fromMs = from ? new Date(from).getTime() : 0;
    const toMs = to ? new Date(to).getTime() : Infinity;

    const payments = this.subscriptionsService
      .getCompletedPayments()
      .filter((c) => {
        const t = new Date(c.updatedAt).getTime();
        return (
          (!creator || c.creatorAddress === creator) &&
          t >= fromMs &&
          t <= toMs
        );
      });

    // Group by creator + asset
    const grouped = new Map<string, EarningsSummary>();
    for (const c of payments) {
      const key = `${c.creatorAddress}:${c.assetCode}`;
      const existing = grouped.get(key) ?? {
        creator: c.creatorAddress,
        totalGross: '0',
        totalFees: '0',
        totalNet: '0',
        paymentCount: 0,
        asset: c.assetCode,
      };
      const gross = parseFloat(existing.totalGross) + parseFloat(c.amount);
      const fees = parseFloat(existing.totalFees) + parseFloat(c.fee);
      grouped.set(key, {
        ...existing,
        totalGross: gross.toFixed(7),
        totalFees: fees.toFixed(7),
        totalNet: (gross - fees).toFixed(7),
        paymentCount: existing.paymentCount + 1,
      });
    }

    const all = Array.from(grouped.values()).sort((a, b) =>
      parseFloat(b.totalNet) - parseFloat(a.totalNet),
    );

    const total = all.length;
    const data = all.slice((page - 1) * limit, page * limit);
    return new PaginatedResponseDto(data, total, page, limit);
  }

  /**
   * Emits a distinct analytics event for a subscription lifecycle change.
   * First-time subscriptions and renewals are reported as separate event
   * types so downstream consumers (dashboards, MRR) never conflate them.
   */
  emitSubscriptionEvent(event: SubscriptionAnalyticsEvent): SubscriptionAnalyticsEvent {
    // Analytics payloads carry ids and amounts only — no PII beyond ids.
    return {
      type: event.type,
      subscriptionId: event.subscriptionId,
      creator: event.creator,
      fan: event.fan,
      asset: event.asset,
      amount: event.amount,
      occurredAt: event.occurredAt,
    };
  }

  /**
   * Computes MRR per creator/asset. Only renewals count toward recurring
   * revenue; first-time subscriptions are tracked separately as new business.
   */
  getMrr(query: PaymentAnalyticsQueryDto): PaginatedResponseDto<MrrSummary> {
    const { creator, from, to, page = 1, limit = 20 } = query;
    const fromMs = from ? new Date(from).getTime() : 0;
    const toMs = to ? new Date(to).getTime() : Infinity;

    const payments = this.subscriptionsService
      .getCompletedPayments()
      .filter((c) => {
        const t = new Date(c.updatedAt).getTime();
        return (
          (!creator || c.creatorAddress === creator) &&
          t >= fromMs &&
          t <= toMs
        );
      });

    const grouped = new Map<string, MrrSummary>();
    for (const c of payments) {
      const key = `${c.creatorAddress}:${c.assetCode}`;
      const existing = grouped.get(key) ?? {
        creator: c.creatorAddress,
        asset: c.assetCode,
        mrr: '0',
        activeSubscriptions: 0,
        newSubscriptions: 0,
        renewals: 0,
      };
      const isRenewal = c.renewal === true;
      const mrr = isRenewal
        ? parseFloat(existing.mrr) + parseFloat(c.amount)
        : parseFloat(existing.mrr);
      grouped.set(key, {
        ...existing,
        mrr: mrr.toFixed(7),
        activeSubscriptions: existing.activeSubscriptions + 1,
        newSubscriptions: existing.newSubscriptions + (isRenewal ? 0 : 1),
        renewals: existing.renewals + (isRenewal ? 1 : 0),
      });
    }

    const all = Array.from(grouped.values()).sort((a, b) =>
      parseFloat(b.mrr) - parseFloat(a.mrr),
    );

    const total = all.length;
    const data = all.slice((page - 1) * limit, page * limit);
    return new PaginatedResponseDto(data, total, page, limit);
  }
}
