import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  AnalyticsService,
  EarningsSummary,
  PaymentRecord,
} from '../analytics/analytics.service';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { EarningsQueryDto } from './dto/earnings-query.dto';
import { WithdrawalRequestDto } from './dto/withdrawal-request.dto';
import { WithdrawalResponseDto } from './dto/withdrawal-response.dto';

/** Upper bound used when collapsing all of a creator's assets into one summary response. */
const SUMMARY_SCAN_LIMIT = 1000;

@Injectable()
export class EarningsService {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * Per-asset earnings totals (gross/fees/net/count) for a single creator.
   * Unlike the admin-facing analytics endpoint this is always scoped to the
   * caller — there is no `creator` filter to pass through.
   */
  getSummary(creatorId: string, query: EarningsQueryDto): { creator: string; totals: EarningsSummary[] } {
    const { data } = this.analyticsService.getEarnings({
      creator: creatorId,
      from: query.from,
      to: query.to,
      page: 1,
      limit: SUMMARY_SCAN_LIMIT,
    });
    return { creator: creatorId, totals: data };
  }

  /** Paginated, per-payment breakdown for a single creator. */
  getBreakdown(
    creatorId: string,
    query: EarningsQueryDto,
  ): PaginatedResponseDto<PaymentRecord> {
    return this.analyticsService.getPayments({
      creator: creatorId,
      from: query.from,
      to: query.to,
      page: query.page,
      limit: query.limit,
    });
  }

  /**
   * Stub withdrawal endpoint. Records intent and returns a placeholder
   * response so the frontend has a stable contract to build against;
   * automated payout processing is not yet implemented.
   */
  requestWithdrawal(
    creatorId: string,
    request: WithdrawalRequestDto,
  ): WithdrawalResponseDto {
    return {
      id: uuidv4(),
      creator: creatorId,
      amount: request.amount,
      asset: request.asset,
      status: 'pending_manual_review',
      requestedAt: new Date().toISOString(),
      note: 'Automated withdrawal processing is not yet implemented; this request has been recorded for manual review.',
    };
  }
}
