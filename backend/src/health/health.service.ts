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

  async checkDatabase(): Promise<{ status: 'up' | 'down' | 'degraded'; error?: string }> {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'up' };
    } catch (error) {
      return { status: 'down', error: error.message };
    }
  }

  async checkRedis() {
    return { status: 'down' as const, message: 'Redis not configured' };
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
