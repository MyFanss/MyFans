import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SorobanRpcService, SorobanHealthStatus } from '../common/services/soroban-rpc.service';

@Injectable()
export class HealthService {
  constructor(
    private dataSource: DataSource,
    private sorobanRpcService: SorobanRpcService
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
    // Redis is not configured in this project folder yet.
    // Returning 'not_configured' as a placeholder.
    return { status: 'down', message: 'Redis not configured' };
  }

  async checkSorobanRpc(): Promise<SorobanHealthStatus> {
    return this.sorobanRpcService.checkConnectivity();
  }

  async checkSorobanContract(): Promise<SorobanHealthStatus> {
    return this.sorobanRpcService.checkKnownContract();
  }
}
