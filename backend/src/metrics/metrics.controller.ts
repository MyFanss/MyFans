import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import type { MetricsSnapshot } from '../common/services/http-metrics.service';
import { HttpMetricsService } from '../common/services/http-metrics.service';
import { RpcMetricsService, RpcMetricsSnapshot } from '../common/services/rpc-metrics.service';
import { ModerationSlaService, ModerationSlaSnapshot } from '../moderation/moderation-sla.service';

export interface FullMetricsSnapshot extends MetricsSnapshot {
  moderationSla: ModerationSlaSnapshot;
  rpc: RpcMetricsSnapshot;
}

@ApiTags('metrics')
@Controller({ path: 'metrics', version: '1' })
export class MetricsController {
  constructor(
    private readonly httpMetrics: HttpMetricsService,
    private readonly rpcMetrics: RpcMetricsService,
    private readonly moderationSla: ModerationSlaService,
  ) {}

  /**
   * GET /v1/metrics
   * Returns a point-in-time snapshot of per-endpoint SLA metrics,
   * Soroban RPC call metrics, and moderation queue SLA stats.
   */
  @Get()
  @ApiOperation({ summary: 'Per-endpoint HTTP latency, error rate metrics, Soroban RPC metrics, and moderation queue SLA' })
  @ApiQuery({ name: 'route', required: false, description: 'Filter HTTP endpoints by route prefix, e.g. /v1/auth' })
  @ApiResponse({ status: 200, description: 'Metrics snapshot' })
  async getMetrics(@Query('route') routeFilter?: string): Promise<FullMetricsSnapshot> {
    const [httpSnap, rpcSnap, slaSnap] = await Promise.all([
      Promise.resolve(this.httpMetrics.snapshot()),
      Promise.resolve(this.rpcMetrics.snapshot()),
      this.moderationSla.snapshot(),
    ]);

    if (routeFilter) {
      httpSnap.endpoints = httpSnap.endpoints.filter((e) =>
        e.route.startsWith(routeFilter),
      );
    }

    return { ...httpSnap, moderationSla: slaSnap, rpc: rpcSnap };
  }
}
