import { Controller, Get, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller({ path: 'health', version: '1' })
export class HealthController {
    constructor(private readonly healthService: HealthService) { }

    @Get()
    @ApiOperation({ summary: 'Basic health check' })
    @ApiResponse({ status: 200, description: 'Service is healthy' })
    getHealth() {
        return this.healthService.getHealth();
    }

    @Get('detailed')
    @ApiOperation({ summary: 'Detailed health check (all subsystems)' })
    @ApiResponse({ status: 200, description: 'Health status for all subsystems' })
    @ApiResponse({ status: 503, description: 'One or more subsystems are down' })
    async getDetailedHealth(@Res() res: Response) {
        const health = await this.healthService.getDetailedHealth();
        if (health.status === 'down') {
            return res.status(503).json(health);
        } else if (health.status === 'degraded') {
            return res.status(200).json(health);
        }
        return res.status(200).json(health);
    }

    @Get('db')
    @ApiOperation({ summary: 'Database health check' })
    @ApiResponse({ status: 200, description: 'Database is healthy' })
    @ApiResponse({ status: 503, description: 'Database is down' })
    async getDbHealth(@Res() res: Response) {
        const health = await this.healthService.checkDatabase();
        if (health.status === 'down') {
            return res.status(503).json(health);
        } else if (health.status === 'degraded') {
            return res.status(200).json(health);
        }
        return res.status(200).json(health);
    }

    @Get('redis')
    @ApiOperation({ summary: 'Redis health check' })
    @ApiResponse({ status: 200, description: 'Redis is healthy' })
    @ApiResponse({ status: 503, description: 'Redis is down' })
    async getRedisHealth(@Res() res: Response) {
        const health = await this.healthService.checkRedis();
        if (health.status === 'down') {
            return res.status(503).json(health);
        }
        return res.status(200).json(health);
    }

    @Get('soroban')
    @ApiOperation({ summary: 'Soroban RPC health check' })
    @ApiResponse({ status: 200, description: 'Soroban RPC is healthy' })
    @ApiResponse({ status: 503, description: 'Soroban RPC is down' })
    async getSorobanHealth(@Res() res: Response) {
        const health = await this.healthService.checkSorobanRpc();
        if (health.status === 'down') {
            return res.status(503).json(health);
        } else if (health.status === 'degraded') {
            return res.status(200).json(health);
        }
        return res.status(200).json(health);
    }

    @Get('soroban-contract')
    @ApiOperation({ summary: 'Soroban contract health check' })
    @ApiResponse({ status: 200, description: 'Soroban contract is healthy' })
    @ApiResponse({ status: 503, description: 'Soroban contract is down' })
    async getSorobanContractHealth(@Res() res: Response) {
        const health = await this.healthService.checkSorobanContract();
        if (health.status === 'down') {
            return res.status(503).json(health);
        } else if (health.status === 'degraded') {
            return res.status(200).json(health);
        }
        return res.status(200).json(health);
    }

    @Get('queue-metrics')
    @ApiOperation({ summary: 'Worker queue performance metrics' })
    @ApiResponse({ status: 200, description: 'Queue metrics snapshot' })
    getQueueMetrics() {
        return this.healthService.getQueueMetrics();
    }
}
