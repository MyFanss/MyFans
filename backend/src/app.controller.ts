import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';

@Controller({ version: '1' })
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Public()
  getHello(): string {
    return this.appService.getHello();
  }

  /**
   * Liveness probe: process-up only. Must not touch dependencies so that
   * orchestrators do not restart a healthy process when a dependency is down.
   */
  @Get('health')
  @Public()
  @HttpCode(HttpStatus.OK)
  getHealth(): { status: string } {
    return { status: 'ok' };
  }

  /**
   * Readiness probe: actively checks Postgres, Redis and Soroban RPC.
   * When CONTRACT_HEALTH=1 an optional Soroban contract simulate probe runs.
   * Returns 503 with per-dependency reasons when any required dependency is
   * unavailable so orchestrators stop routing traffic to a broken instance.
   */
  @Get('ready')
  @Public()
  async getReady(@Res({ passthrough: true }) res: Response): Promise<{
    status: 'ok' | 'degraded';
    checks: Record<string, { status: 'up' | 'down' | 'skipped'; reason?: string }>;
  }> {
    const result = await this.appService.checkReadiness();
    if (result.status !== 'ok') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return result;
  }
}
