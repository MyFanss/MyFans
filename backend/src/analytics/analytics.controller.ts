import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AnalyticsService, DashboardSummary } from './analytics.service';

/**
 * Analytics controller — creator-facing endpoints.
 *
 * All aggregate endpoints are creator-only: the requesting user must be the
 * same creator as the :creatorId param. Authorization is enforced by
 * AnalyticsService.getDashboardSummary / getMrrSnapshot.
 */
@Controller({ path: 'analytics', version: '1' })
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * GET /v1/analytics/:creatorId/summary
   *
   * Returns the live dashboard summary for the creator. Creator-only:
   * returns 403 if the requester is not the creator.
   *
   * Query params:
   *   periodStart — ISO-8601 UTC, defaults to start of current calendar month
   *   periodEnd   — ISO-8601 UTC, defaults to now
   */
  @Get(':creatorId/summary')
  getDashboardSummary(
    @Param('creatorId') creatorId: string,
    @Req() req: Request,
    @Query('periodStart') periodStartQ?: string,
    @Query('periodEnd') periodEndQ?: string,
  ): DashboardSummary {
    const requesterId = (req as Request & { user?: { userId?: string; id?: string } }).user?.userId
      ?? (req as Request & { user?: { userId?: string; id?: string } }).user?.id
      ?? '';

    const now = new Date();
    const periodStart = periodStartQ
      ? new Date(periodStartQ)
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const periodEnd = periodEndQ ? new Date(periodEndQ) : now;

    return this.analyticsService.getDashboardSummary(
      creatorId,
      requesterId,
      periodStart,
      periodEnd,
    );
  }
}
