import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { Public } from './common/decorators/public.decorator';

@Controller({ version: '1' })
export class AppController {
  @Get()
  @Public()
  getHello(): string {
    return 'Hello World!';
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
   * Readiness probe: reports process readiness without touching optional
   * dependencies that are not yet wired into the application module.
   * Returns 200 with an ok status so orchestrators keep routing traffic.
   */
  @Get('ready')
  @Public()
  async getReady(@Res({ passthrough: true }) res: Response): Promise<{
    status: 'ok' | 'degraded';
    checks: Record<string, { status: 'up' | 'down' | 'skipped'; reason?: string }>;
  }> {
    return { status: 'ok', checks: {} };
  }
}
