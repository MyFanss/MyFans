import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { PaymentAnalyticsQueryDto } from './dto/payment-analytics-query.dto';

@ApiTags('analytics')
@Controller({ path: 'analytics', version: '1' })
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * GET /v1/analytics/payments
   * Paginated list of completed payments, filterable by creator and date range.
   */
  @Get('payments')
  @ApiOperation({ summary: 'List completed payments with optional filters' })
  getPayments(@Query() query: PaymentAnalyticsQueryDto) {
    return this.analyticsService.getPayments(query);
  }

  /**
   * GET /v1/analytics/earnings
   * Aggregated earnings per creator (gross, fees, net), filterable by creator and date range.
   */
  @Get('earnings')
  @ApiOperation({ summary: 'Aggregated creator earnings' })
  getEarnings(@Query() query: PaymentAnalyticsQueryDto) {
    return this.analyticsService.getEarnings(query);
  }
}
