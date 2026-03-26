import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SorobanRpcService, SorobanHealthStatus } from '../common/services/soroban-rpc.service';
import { QueueMetricsService, QueueSnapshot } from '../common/services/queue-metrics.service';

@Injectable()
export class HealthService {
  constructor(
    private dataSource: DataSource,
    private sorobanRpcService: SorobanRpcService,
    private queueMetrics: QueueMetricsService,
  ) {}

  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  async checkDatabase() {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'up' };
    } catch (error) {
      return { status: 'down', error: error.message };
    }
  }

  async checkRedis() {
    return { status: 'down', message: 'Redis not configured' };
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
