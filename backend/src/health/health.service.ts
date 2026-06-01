import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SorobanRpcService, SorobanHealthStatus } from '../common/services/soroban-rpc.service';
import { QueueMetricsService, QueueSnapshot } from '../common/services/queue-metrics.service';

export interface HealthCheckResult {
    status: 'up' | 'down' | 'degraded';
    timestamp: string;
}

export interface DetailedHealthCheckResult extends HealthCheckResult {
    checks?: {
        database?: { status: 'up' | 'down' | 'degraded'; error?: string };
        sorobanRpc?: SorobanHealthStatus;
        sorobanContract?: SorobanHealthStatus;
    };
}

export interface AggregatedHealthResult {
  status: 'up' | 'down' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  subsystems: {
    database: { status: 'up' | 'down' | 'degraded'; latencyMs?: number; error?: string };
    redis: { status: 'up' | 'down' | 'degraded'; latencyMs?: number; error?: string };
    sorobanRpc: SorobanHealthStatus;
    sorobanContract: SorobanHealthStatus;
  };
  summary: {
    total: number;
    up: number;
    degraded: number;
    down: number;
  };
}

const START_TIME = Date.now();

@Injectable()
export class HealthService {
  constructor(
    private dataSource: DataSource,
    private sorobanRpcService: SorobanRpcService,
    private queueMetrics: QueueMetricsService,
  ) {}

  getHealth(): DetailedHealthCheckResult {
    return {
      status: 'ok' as any, // Legacy compatibility
      timestamp: new Date().toISOString(),
    };
  }

  async getDetailedHealth(): Promise<DetailedHealthCheckResult> {
    const [dbHealth, rpcHealth, contractHealth] = await Promise.all([
      this.checkDatabase(),
      this.checkSorobanRpc(),
      this.checkSorobanContract(),
    ]);

    // Determine overall status
    let overallStatus: 'up' | 'down' | 'degraded' = 'up';

    if (dbHealth.status === 'down') {
      overallStatus = 'down';
    } else if (rpcHealth.status === 'down' || contractHealth.status === 'down') {
      overallStatus = 'down';
    } else if (
      rpcHealth.status === 'degraded' ||
      contractHealth.status === 'degraded' ||
      dbHealth.status === 'degraded'
    ) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks: {
        database: dbHealth,
        sorobanRpc: rpcHealth,
        sorobanContract: contractHealth,
      },
    };
  }

  /**
   * Aggregated health check — runs all subsystem checks in parallel and
   * returns a structured summary with per-subsystem latency and a numeric
   * summary (total / up / degraded / down).
   *
   * HTTP status mapping (used by the controller):
   *   overall 'up'       → 200
   *   overall 'degraded' → 200  (service is functional but impaired)
   *   overall 'down'     → 503
   */
  async getAggregatedHealth(): Promise<AggregatedHealthResult> {
    const [dbHealth, redisHealth, rpcHealth, contractHealth] = await Promise.all([
      this.checkDatabaseWithLatency(),
      this.checkRedis(),
      this.checkSorobanRpc(),
      this.checkSorobanContract(),
    ]);

    const subsystems = [
      dbHealth.status,
      redisHealth.status,
      rpcHealth.status,
      contractHealth.status,
    ] as const;

    const summary = {
      total: subsystems.length,
      up: subsystems.filter((s) => s === 'up').length,
      degraded: subsystems.filter((s) => s === 'degraded').length,
      down: subsystems.filter((s) => s === 'down').length,
    };

    let overallStatus: 'up' | 'down' | 'degraded' = 'up';
    if (summary.down > 0) {
      // Database down is always fatal; other subsystems degrade the service
      overallStatus = dbHealth.status === 'down' ? 'down' : 'degraded';
    } else if (summary.degraded > 0) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - START_TIME) / 1000),
      version: process.env.npm_package_version ?? 'unknown',
      subsystems: {
        database: dbHealth,
        redis: redisHealth,
        sorobanRpc: rpcHealth,
        sorobanContract: contractHealth,
      },
      summary,
    };
  }

  async checkDatabase(): Promise<{ status: 'up' | 'down' | 'degraded'; error?: string }> {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'up' };
    } catch (error) {
      return { status: 'down', error: error.message };
    }
  }

  private async checkDatabaseWithLatency(): Promise<{
    status: 'up' | 'down' | 'degraded';
    latencyMs?: number;
    error?: string;
  }> {
    const start = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'up', latencyMs: Date.now() - start };
    } catch (error) {
      return { status: 'down', latencyMs: Date.now() - start, error: error.message };
    }
  }

  async checkRedis(): Promise<{ status: 'up' | 'down' | 'degraded'; latencyMs?: number; error?: string }> {
    // Redis is not yet wired — return a stable 'down' so the aggregator can
    // include it in the summary without crashing. When Redis is configured,
    // replace this stub with a real PING check.
    return { status: 'down', error: 'Redis not configured' };
  }

  async checkSorobanRpc(): Promise<SorobanHealthStatus> {
    return this.sorobanRpcService.checkConnectivity();
  }

  async checkSorobanContract(): Promise<SorobanHealthStatus> {
    return this.sorobanRpcService.checkKnownContract();
  }

  getQueueMetrics(): { timestamp: string; queues: QueueSnapshot } {
    return {
      timestamp: new Date().toISOString(),
      queues: this.queueMetrics.snapshot(),
    };
  }
}
