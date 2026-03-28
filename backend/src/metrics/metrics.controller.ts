import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import type { MetricsSnapshot } from '../common/services/http-metrics.service';
import { HttpMetricsService } from '../common/services/http-metrics.service';

@ApiTags('metrics')
@Controller({ path: 'metrics', version: '1' })
export class MetricsController {
  constructor(private readonly httpMetrics: HttpMetricsService) {}

  /**
   * GET /v1/metrics
   * Returns a point-in-time snapshot of per-endpoint SLA metrics.
   * Optionally filter to a single route prefix.
   */
  @Get()
  @ApiOperation({ summary: 'Per-endpoint HTTP latency and error rate metrics' })
  @ApiQuery({ name: 'route', required: false, description: 'Filter by route prefix, e.g. /v1/auth' })
  @ApiResponse({ status: 200, description: 'Metrics snapshot' })
  getMetrics(@Query('route') routeFilter?: string): MetricsSnapshot {
    const snapshot = this.httpMetrics.snapshot();

    if (routeFilter) {
      snapshot.endpoints = snapshot.endpoints.filter((e) =>
        e.route.startsWith(routeFilter),
      );
    }

    return snapshot;
  }
}
