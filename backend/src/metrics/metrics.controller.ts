import { Controller, Get, Header, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import type { MetricsSnapshot } from '../common/services/http-metrics.service';
import { HttpMetricsService } from '../common/services/http-metrics.service';
import { RpcMetricsService, RpcMetricsSnapshot } from '../common/services/rpc-metrics.service';
import { ModerationSlaService, ModerationSlaSnapshot } from '../moderation/moderation-sla.service';

export type MetricSeverity = 'warning' | 'critical';

export interface MetricsAlert {
  id: string;
  severity: MetricSeverity;
  source: 'http' | 'rpc';
  metric: string;
  message: string;
  route?: string;
  method?: string;
  value: number;
  threshold: number;
}

export interface FullMetricsSnapshot extends MetricsSnapshot {
  moderationSla: ModerationSlaSnapshot;
  rpc: RpcMetricsSnapshot;
  alerts: MetricsAlert[];
}

const HTTP_ERROR_RATE_THRESHOLD = 0.01;
const HTTP_P95_LATENCY_THRESHOLD_MS = 500;
const HTTP_P99_LATENCY_THRESHOLD_MS = 1000;
const RPC_ERROR_RATE_THRESHOLD = 0.05;
const RPC_AVG_LATENCY_THRESHOLD_MS = 1500;

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

    const alerts = this.buildAlerts(httpSnap, rpcSnap);
    return { ...httpSnap, moderationSla: slaSnap, rpc: rpcSnap, alerts };
  }

  @Get('prometheus')
  @Header('Content-Type', 'text/plain; version=0.0.4')
  @ApiOperation({ summary: 'Prometheus scrape endpoint for HTTP and Soroban RPC metrics' })
  @ApiQuery({ name: 'route', required: false, description: 'Filter HTTP endpoints by route prefix, e.g. /v1/auth' })
  @ApiResponse({ status: 200, description: 'Prometheus metrics text format' })
  async getPrometheusMetrics(@Query('route') routeFilter?: string): Promise<string> {
    const [httpSnap, rpcSnap] = await Promise.all([
      Promise.resolve(this.httpMetrics.snapshot()),
      Promise.resolve(this.rpcMetrics.snapshot()),
    ]);

    if (routeFilter) {
      httpSnap.endpoints = httpSnap.endpoints.filter((e) =>
        e.route.startsWith(routeFilter),
      );
    }

    return this.renderPrometheus(httpSnap, rpcSnap);
  }

  private buildAlerts(
    httpSnap: MetricsSnapshot,
    rpcSnap: RpcMetricsSnapshot,
  ): MetricsAlert[] {
    const alerts: MetricsAlert[] = [];

    for (const endpoint of httpSnap.endpoints) {
      if (endpoint.errorRate > HTTP_ERROR_RATE_THRESHOLD) {
        alerts.push({
          id: `http-error-rate:${endpoint.method}:${endpoint.route}`,
          severity: 'critical',
          source: 'http',
          metric: 'errorRate',
          message: `HTTP error rate for ${endpoint.method} ${endpoint.route} is above ${HTTP_ERROR_RATE_THRESHOLD}`,
          route: endpoint.route,
          method: endpoint.method,
          value: endpoint.errorRate,
          threshold: HTTP_ERROR_RATE_THRESHOLD,
        });
      }

      if (endpoint.p95Ms > HTTP_P95_LATENCY_THRESHOLD_MS) {
        alerts.push({
          id: `http-p95-latency:${endpoint.method}:${endpoint.route}`,
          severity: 'warning',
          source: 'http',
          metric: 'p95Ms',
          message: `HTTP p95 latency for ${endpoint.method} ${endpoint.route} is above ${HTTP_P95_LATENCY_THRESHOLD_MS}ms`,
          route: endpoint.route,
          method: endpoint.method,
          value: endpoint.p95Ms,
          threshold: HTTP_P95_LATENCY_THRESHOLD_MS,
        });
      }

      if (endpoint.p99Ms > HTTP_P99_LATENCY_THRESHOLD_MS) {
        alerts.push({
          id: `http-p99-latency:${endpoint.method}:${endpoint.route}`,
          severity: 'critical',
          source: 'http',
          metric: 'p99Ms',
          message: `HTTP p99 latency for ${endpoint.method} ${endpoint.route} is above ${HTTP_P99_LATENCY_THRESHOLD_MS}ms`,
          route: endpoint.route,
          method: endpoint.method,
          value: endpoint.p99Ms,
          threshold: HTTP_P99_LATENCY_THRESHOLD_MS,
        });
      }
    }

    for (const endpoint of rpcSnap.endpoints) {
      if (endpoint.errorRate > RPC_ERROR_RATE_THRESHOLD) {
        alerts.push({
          id: `rpc-error-rate:${endpoint.method}`,
          severity: 'critical',
          source: 'rpc',
          metric: 'errorRate',
          message: `RPC error rate for ${endpoint.method} is above ${RPC_ERROR_RATE_THRESHOLD}`,
          method: endpoint.method,
          value: endpoint.errorRate,
          threshold: RPC_ERROR_RATE_THRESHOLD,
        });
      }

      if (endpoint.avgLatencyMs > RPC_AVG_LATENCY_THRESHOLD_MS) {
        alerts.push({
          id: `rpc-latency:${endpoint.method}`,
          severity: 'warning',
          source: 'rpc',
          metric: 'avgLatencyMs',
          message: `RPC average latency for ${endpoint.method} is above ${RPC_AVG_LATENCY_THRESHOLD_MS}ms`,
          method: endpoint.method,
          value: endpoint.avgLatencyMs,
          threshold: RPC_AVG_LATENCY_THRESHOLD_MS,
        });
      }
    }

    return alerts;
  }

  private renderPrometheus(
    httpSnap: MetricsSnapshot,
    rpcSnap: RpcMetricsSnapshot,
  ): string {
    const lines: string[] = [];
    lines.push('# HELP backend_http_requests_total Total HTTP requests received');
    lines.push('# TYPE backend_http_requests_total counter');
    lines.push('# HELP backend_http_request_errors_total Total HTTP errors by class');
    lines.push('# TYPE backend_http_request_errors_total counter');
    lines.push('# HELP backend_http_request_duration_seconds Histogram of HTTP request durations in seconds');
    lines.push('# TYPE backend_http_request_duration_seconds histogram');
    lines.push('# HELP backend_soroban_rpc_calls_total Total Soroban RPC calls by method and outcome');
    lines.push('# TYPE backend_soroban_rpc_calls_total counter');
    lines.push('# HELP backend_soroban_rpc_duration_seconds_total Total Soroban RPC duration in seconds');
    lines.push('# TYPE backend_soroban_rpc_duration_seconds_total counter');
    lines.push('# HELP backend_soroban_rpc_duration_seconds_count Total Soroban RPC duration count');
    lines.push('# TYPE backend_soroban_rpc_duration_seconds_count counter');

    for (const endpoint of httpSnap.endpoints) {
      const labels = this.prometheusLabels({ method: endpoint.method, route: endpoint.route });
      lines.push(`backend_http_requests_total${labels} ${endpoint.requests}`);
      lines.push(`backend_http_request_errors_total${labels},code="4xx" ${endpoint.errors4xx}`);
      lines.push(`backend_http_request_errors_total${labels},code="5xx" ${endpoint.errors5xx}`);

      const histogramBuckets = this.cumulativeHistogram(endpoint.histogram);
      for (const [bound, count] of Object.entries(histogramBuckets)) {
        const le = bound === 'Infinity' ? '+Inf' : (Number(bound) / 1000).toFixed(3);
        lines.push(
          `backend_http_request_duration_seconds_bucket${labels},le="${le}" ${count}`,
        );
      }
      lines.push(`backend_http_request_duration_seconds_sum${labels} ${endpoint.totalLatencyMs / 1000}`);
      lines.push(`backend_http_request_duration_seconds_count${labels} ${endpoint.requests}`);
    }

    for (const endpoint of rpcSnap.endpoints) {
      const labels = this.prometheusLabels({ method: endpoint.method });
      lines.push(`backend_soroban_rpc_calls_total${labels},outcome="success" ${endpoint.successes}`);
      lines.push(`backend_soroban_rpc_calls_total${labels},outcome="failure" ${endpoint.failures}`);
      lines.push(`backend_soroban_rpc_duration_seconds_total${labels} ${endpoint.totalLatencyMs / 1000}`);
      lines.push(`backend_soroban_rpc_duration_seconds_count${labels} ${endpoint.calls}`);
    }

    return lines.join('\n') + '\n';
  }

  private prometheusLabels(values: Record<string, string>): string {
    const parts = Object.entries(values).map(
      ([key, value]) => `${key}="${value.replace(/"/g, '\\"')}"`,
    );
    return parts.length ? `{${parts.join(',')}}` : '';
  }

  private cumulativeHistogram(histogram: Record<number, number>): Record<number, number> {
    const ordered = Object.keys(histogram)
      .map((key) => (key === 'Infinity' ? Infinity : Number(key)))
      .sort((a, b) => a - b);
    const cumulative: Record<number, number> = {};
    let running = 0;
    for (const bucket of ordered) {
      running += histogram[bucket];
      cumulative[bucket] = running;
    }
    return cumulative;
  }
}
