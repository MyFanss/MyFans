import {
  Body,
  ConflictException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { createHash } from 'crypto';

/**
 * Idempotency semantics for money paths (see backend/docs/IDEMPOTENCY.md).
 *
 * - Idempotency-Key is required on checkout confirm and other money paths.
 * - The stored value is hash(body) + response, keyed by the idempotency key.
 * - Same key + same body  -> cached response is replayed.
 * - Same key + different body -> 409 Conflict.
 * - Entries expire after a TTL so keys can be reused later.
 *
 * The store below is an in-process implementation with TTL. It is swappable
 * for a Redis-backed store for multi-instance deployments; the interface is
 * intentionally minimal so the controller logic does not change.
 */

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const MAX_BODY_BYTES = 1024 * 1024; // 1MB guard against huge bodies

/**
 * Tracing is opt-in via env (see backend/docs/TRACING.md). When disabled the
 * span helper is a no-op so there is no overhead on the money path.
 */
const TRACING_ENABLED = process.env.TRACING_ENABLED === 'true';

interface Span {
  end(): void;
  setAttribute(key: string, value: string): void;
}

/**
 * Minimal span emitter. Kept dependency-free and swappable for an OTel
 * exporter; only non-PII attributes (correlation id, route, outcome) are set.
 */
function startSpan(name: string): Span {
  if (!TRACING_ENABLED) {
    return { end: () => undefined, setAttribute: () => undefined };
  }
  const startedAt = Date.now();
  return {
    end: () => {
      // eslint-disable-next-line no-console
      console.debug(
        JSON.stringify({ span: name, durationMs: Date.now() - startedAt }),
      );
    },
    setAttribute: () => undefined,
  };
}

interface IdempotencyRecord {
  bodyHash: string;
  status: number;
  response: unknown;
  expiresAt: number;
}

interface IdempotencyStore {
  get(key: string): IdempotencyRecord | undefined;
  set(key: string, record: IdempotencyRecord): void;
}

class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly records = new Map<string, IdempotencyRecord>();

  get(key: string): IdempotencyRecord | undefined {
    const record = this.records.get(key);
    if (!record) {
      return undefined;
    }
    if (record.expiresAt <= Date.now()) {
      this.records.delete(key);
      return undefined;
    }
    return record;
  }

  set(key: string, record: IdempotencyRecord): void {
    this.records.set(key, record);
  }
}

const idempotencyStore: IdempotencyStore = new InMemoryIdempotencyStore();

function hashBody(body: unknown): string {
  const serialized = JSON.stringify(body ?? null);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_BODY_BYTES) {
    throw new ConflictException('Request body too large for idempotent processing');
  }
  return createHash('sha256').update(serialized).digest('hex');
}

function requireIdempotencyKey(key: string | undefined): string {
  if (!key || key.trim().length === 0) {
    throw new ConflictException('Idempotency-Key header is required');
  }
  return key.trim();
}

@Controller('checkout')
export class CheckoutController {
  /**
   * Confirm a checkout / subscribe. Money path: requires Idempotency-Key.
   */
  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  async confirm(
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-correlation-id') correlationId: string | undefined,
    @Body() body: Record<string, unknown>,
    @Req() _req: Request,
  ): Promise<unknown> {
    const span = startSpan('checkout.confirm');
    span.setAttribute('correlation.id', correlationId ?? 'unknown');
    try {
      const key = requireIdempotencyKey(idempotencyKey);
      const bodyHash = hashBody(body);

      const existing = idempotencyStore.get(key);
      if (existing) {
        if (existing.bodyHash !== bodyHash) {
          span.setAttribute('checkout.outcome', 'conflict');
          throw new ConflictException(
            'Idempotency-Key was reused with a different request body',
          );
        }
        span.setAttribute('checkout.outcome', 'replayed');
        return existing.response;
      }

      const response = await this.processCheckout(body);

      idempotencyStore.set(key, {
        bodyHash,
        status: HttpStatus.OK,
        response,
        expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
      });

      span.setAttribute('checkout.outcome', 'confirmed');
      return response;
    } finally {
      span.end();
    }
  }

  /**
   * Placeholder for the actual checkout/subscribe fulfillment. Kept separate
   * so idempotency wrapping stays independent of business logic.
   */
  private async processCheckout(
    body: Record<string, unknown>,
  ): Promise<unknown> {
    return { status: 'confirmed', checkout: body };
  }
}
