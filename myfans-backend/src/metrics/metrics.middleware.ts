import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const start = performance.now();
    res.on('finish', () => {
      const duration = (performance.now() - start) / 1000;
      const route = req.route?.path ?? req.path ?? req.url ?? '';
      this.metrics.recordHttpRequest(
        req.method,
        route,
        res.statusCode,
        duration,
      );
    });
    next();
  }
}
