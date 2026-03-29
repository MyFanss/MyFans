import {
  ConflictException,
  Injectable,
  Logger,
  NestMiddleware,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { IdempotencyService } from './idempotency.service';

/** Header name clients must send. */
export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';

/** Maximum allowed key length to prevent abuse. */
const MAX_KEY_LENGTH = 255;

@Injectable()
export class IdempotencyMiddleware implements NestMiddleware {
  private readonly logger = new Logger(IdempotencyMiddleware.name);

  constructor(private readonly idempotencyService: IdempotencyService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const rawKey = req.headers[IDEMPOTENCY_KEY_HEADER] as string | undefined;

    // No key supplied — pass through (key is optional; callers that want
    // idempotency protection must supply it).
    if (!rawKey) {
      return next();
    }

    if (rawKey.length > MAX_KEY_LENGTH) {
      throw new UnprocessableEntityException(
        `Idempotency-Key must not exceed ${MAX_KEY_LENGTH} characters.`,
      );
    }

    const key = rawKey.trim();
    const fingerprint = this.buildFingerprint(req);
    const method = req.method.toUpperCase();
    const path = req.path;

    try {
      const cached = await this.idempotencyService.acquire(
        key,
        fingerprint,
        method,
        path,
      );

      if (cached !== null) {
        // Duplicate request — replay the original response.
        this.logger.debug(
          `Replaying cached response for idempotency key "${key}" [${method} ${path}]`,
        );
        res.status(cached.status).json(cached.body);
        return;
      }
    } catch (err) {
      if (err instanceof ConflictException) {
        // Re-throw so NestJS exception filters handle it correctly.
        throw err;
      }
      throw err;
    }

    // Intercept the response so we can cache it after the handler runs.
    const originalJson = res.json.bind(res);

    res.json = (body: unknown): Response => {
      const status = res.statusCode;

      // Only cache successful responses (2xx). On errors the client should
      // be able to retry with the same key after fixing the issue.
      if (status >= 200 && status < 300) {
        this.idempotencyService
          .complete(key, fingerprint, status, body)
          .catch((err) =>
            this.logger.error(
              `Failed to persist idempotency response for key "${key}": ${err?.message}`,
            ),
          );
      } else {
        // Release the lock so the client can retry with the same key.
        this.idempotencyService
          .release(key, fingerprint)
          .catch((err) =>
            this.logger.error(
              `Failed to release idempotency key "${key}": ${err?.message}`,
            ),
          );
      }

      return originalJson(body);
    };

    next();
  }

  /**
   * Build a caller fingerprint.
   * Uses the authenticated user's ID when available (set by auth middleware),
   * otherwise falls back to the client IP address.
   */
  private buildFingerprint(req: Request): string {
    const userId = (req as any).user?.id ?? (req as any).user?.userId;
    if (userId) return `user:${userId}`;
    return `ip:${req.ip ?? 'unknown'}`;
  }
}
