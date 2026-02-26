import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { HealthService } from './health.service';

@Controller({ path: 'health', version: '1' })
export class HealthController {
    constructor(private readonly healthService: HealthService) { }

    @Get()
    getHealth() {
        return this.healthService.getHealth();
    }

    @Get('db')
    async getDbHealth(@Res() res: Response) {
        const health = await this.healthService.checkDatabase();
        if (health.status === 'down') {
            return res.status(503).json(health);
        }
        return res.status(200).json(health);
    }

    @Get('redis')
    async getRedisHealth(@Res() res: Response) {
        const health = await this.healthService.checkRedis();
        // Since Redis is not configured, we return 503 if we consider it essential,
        // or 200 with a message if it's optional.
        // Given the requirement "Return 503 if DB or Redis down (optional)", I'll return 503.
        if (health.status === 'down') {
            return res.status(503).json(health);
        }
        return res.status(200).json(health);
    }

    @Get('soroban')
    async getSorobanHealth(@Res() res: Response) {
        const health = await this.healthService.checkSorobanRpc();
        if (health.status === 'down') {
            return res.status(503).json(health);
        }
        return res.status(200).json(health);
    }

    @Get('soroban-contract')
    async getSorobanContractHealth(@Res() res: Response) {
        const health = await this.healthService.checkSorobanContract();
        if (health.status === 'down') {
            return res.status(503).json(health);
        }
        return res.status(200).json(health);
    }
}
