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
}
