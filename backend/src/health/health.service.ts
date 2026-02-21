import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class HealthService {
  constructor(private dataSource: DataSource) {}

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
}
