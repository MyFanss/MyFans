import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { HttpMetricsService } from '../services/http-metrics.service';

/**
 * Normalise an Express path into a stable route pattern so that
 * /v1/users/abc-123 and /v1/users/def-456 both map to /v1/users/:id.
 *
 * Rules (applied in order):
 *  1. UUIDs          → :id
 *  2. Numeric IDs    → :id
 *  3. Stellar G-keys → :address
 *  4. Hex strings ≥16 chars → :hash
 */
function normaliseRoute(url: string): string {
  // Strip query string
  const path = url.split('?')[0];

  return path
    .split('/')
    .map((segment) => {
      if (!segment) return segment;
      // UUID
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment))
        return ':id';
      // Pure numeric
      if (/^\d+$/.test(segment)) return ':id';
      // Stellar G-address (56-char base32)
      if (/^G[A-Z2-7]{55}$/.test(segment)) return ':address';
      // Hex hash ≥ 16 chars
      if (/^[0-9a-f]{16,}$/i.test(segment)) return ':hash';
      return segment;
    })
    .join('/');
}

/** Paths that should never appear in metrics (health probes, docs). */
const SKIP_PATHS = new Set(['/favicon.ico', '/api/docs', '/api/docs/json']);

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly httpMetrics: HttpMetricsService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const startMs = Date.now();
    const { method } = req;
    const rawPath = req.originalUrl ?? req.url;

    // Skip internal/infra paths
    if (SKIP_PATHS.has(rawPath.split('?')[0])) {
      return next();
    }

    res.on('finish', () => {
      const latencyMs = Date.now() - startMs;
      const route = normaliseRoute(rawPath);
      this.httpMetrics.record(method, route, res.statusCode, latencyMs);
    });

    next();
  }
}
