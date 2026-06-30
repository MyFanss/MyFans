import { Controller, Get, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { HealthService } from './health.service';
import {
  HealthStatusDto,
  DetailedHealthStatusDto,
  AggregatedHealthDto,
  SubsystemStatusDto,
  QueueMetricsDto,
} from './dto/health-response.dto';

@ApiTags('health')
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Basic health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy', type: HealthStatusDto })
  getHealth() {
    return this.healthService.getHealth();
  }

  @Get('detailed')
  @Throttle({ medium: { limit: 50, ttl: 60000 } })
  @ApiOperation({ summary: 'Detailed health check (all subsystems)' })
  @ApiResponse({
    status: 200,
    description: 'Health status for all subsystems (up or degraded)',
    type: DetailedHealthStatusDto,
  })
  @ApiResponse({
    status: 503,
    description: 'One or more subsystems are down',
    type: DetailedHealthStatusDto,
  })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async getDetailedHealth(@Res() res: Response) {
    const health = await this.healthService.getDetailedHealth();
    const httpStatus = health.status === 'down' ? 503 : 200;
    return res.status(httpStatus).json(health);
  }

  @Get('aggregate')
  @Throttle({ medium: { limit: 50, ttl: 60000 } })
  @ApiOperation({
    summary: 'Aggregated health check with per-subsystem summary',
    description:
      'Runs all subsystem checks in parallel and returns a structured ' +
      'summary including per-subsystem latency, uptime, version, and a ' +
      'numeric breakdown (total/up/degraded/down). ' +
      'Returns 200 for "up" and "degraded", 503 for "down".',
  })
  @ApiResponse({
    status: 200,
    description: 'Service is up or degraded — includes subsystem breakdown',
    type: AggregatedHealthDto,
  })
  @ApiResponse({
    status: 503,
    description: 'Service is down — database or critical subsystem unreachable',
    type: AggregatedHealthDto,
  })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async getAggregatedHealth(@Res() res: Response) {
    const health = await this.healthService.getAggregatedHealth();
    const httpStatus = health.status === 'down' ? 503 : 200;
    return res.status(httpStatus).json(health);
  }

  @Get('db')
  @Throttle({ medium: { limit: 50, ttl: 60000 } })
  @ApiOperation({ summary: 'Database health check' })
  @ApiResponse({ status: 200, description: 'Database is healthy', type: SubsystemStatusDto })
  @ApiResponse({ status: 503, description: 'Database is down', type: SubsystemStatusDto })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async getDbHealth(@Res() res: Response) {
    const health = await this.healthService.checkDatabase();
    const httpStatus = health.status === 'down' ? 503 : 200;
    return res.status(httpStatus).json(health);
  }

  @Get('redis')
  @Throttle({ medium: { limit: 50, ttl: 60000 } })
  @ApiOperation({ summary: 'Redis health check' })
  @ApiResponse({ status: 200, description: 'Redis is healthy', type: SubsystemStatusDto })
  @ApiResponse({ status: 503, description: 'Redis is down', type: SubsystemStatusDto })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async getRedisHealth(@Res() res: Response) {
    const health = await this.healthService.checkRedis();
    const httpStatus = health.status === 'down' ? 503 : 200;
    return res.status(httpStatus).json(health);
  }

  @Get('soroban')
  @Throttle({ medium: { limit: 50, ttl: 60000 } })
  @ApiOperation({ summary: 'Soroban RPC health check' })
  @ApiResponse({ status: 200, description: 'Soroban RPC is healthy or degraded', type: DetailedHealthStatusDto })
  @ApiResponse({ status: 503, description: 'Soroban RPC is down', type: DetailedHealthStatusDto })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async getSorobanHealth(@Res() res: Response) {
    const health = await this.healthService.checkSorobanRpc();
    const httpStatus = health.status === 'down' ? 503 : 200;
    return res.status(httpStatus).json(health);
  }

  @Get('soroban-contract')
  @Throttle({ medium: { limit: 50, ttl: 60000 } })
  @ApiOperation({ summary: 'Soroban contract health check' })
  @ApiResponse({ status: 200, description: 'Soroban contract is healthy or degraded', type: DetailedHealthStatusDto })
  @ApiResponse({ status: 503, description: 'Soroban contract is down', type: DetailedHealthStatusDto })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async getSorobanContractHealth(@Res() res: Response) {
    const health = await this.healthService.checkSorobanContract();
    const httpStatus = health.status === 'down' ? 503 : 200;
    return res.status(httpStatus).json(health);
  }

  @Get('queue-metrics')
  @Throttle({ medium: { limit: 50, ttl: 60000 } })
  @ApiOperation({ summary: 'Worker queue performance metrics' })
  @ApiResponse({ status: 200, description: 'Queue metrics snapshot', type: QueueMetricsDto })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  getQueueMetrics() {
    return this.healthService.getQueueMetrics();
  }
}
