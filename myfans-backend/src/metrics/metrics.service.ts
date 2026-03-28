import { Injectable } from '@nestjs/common';
import {
  Registry,
  Counter,
  Histogram,
  collectDefaultMetrics,
} from 'prom-client';

/** Normalize path for metrics: replace UUID-like segments with _id to avoid PII in labels. */
export function normalizePath(path: string): string {
  if (!path || path === '/') return path;
  const segments = path.split('/').filter(Boolean);
  const normalized = segments.map((seg) => {
    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        seg,
      )
    ) {
      return '_id';
    }
    if (/^\d+$/.test(seg)) return '_id';
    return seg;
  });
  return '/' + normalized.join('/');
}

@Injectable()
export class MetricsService {
  readonly registry: Registry;
  readonly httpRequestTotal: Counter<string>;
  readonly httpRequestDuration: Histogram<string>;
  readonly rpcCallTotal: Counter<string>;
  readonly rpcCallErrors: Counter<string>;
  readonly rpcCallDuration: Histogram<string>;

  constructor() {
    this.registry = new Registry();
    this.registry.setDefaultLabels({ app: 'myfans-backend' });

    this.httpRequestTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request latency in seconds',
      labelNames: ['method', 'route'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [this.registry],
    });

    this.rpcCallTotal = new Counter({
      name: 'rpc_calls_total',
      help: 'Total RPC calls (e.g. Soroban RPC)',
      labelNames: ['operation', 'status'],
      registers: [this.registry],
    });

    this.rpcCallErrors = new Counter({
      name: 'rpc_call_errors_total',
      help: 'Total RPC call errors',
      labelNames: ['operation'],
      registers: [this.registry],
    });

    this.rpcCallDuration = new Histogram({
      name: 'rpc_call_duration_seconds',
      help: 'RPC call latency in seconds',
      labelNames: ['operation'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [this.registry],
    });

    collectDefaultMetrics({ register: this.registry });
  }

  recordHttpRequest(
    method: string,
    route: string,
    status: number,
    durationSeconds: number,
  ): void {
    const routeNorm = normalizePath(route);
    const statusStr = String(status);
    this.httpRequestTotal.inc({ method, route: routeNorm, status: statusStr });
    this.httpRequestDuration.observe(
      { method, route: routeNorm },
      durationSeconds,
    );
  }

  recordRpcCall(
    operation: string,
    durationSeconds: number,
    error: boolean,
  ): void {
    const status = error ? 'error' : 'success';
    this.rpcCallTotal.inc({ operation, status });
    if (error) {
      this.rpcCallErrors.inc({ operation });
    }
    this.rpcCallDuration.observe({ operation }, durationSeconds);
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
