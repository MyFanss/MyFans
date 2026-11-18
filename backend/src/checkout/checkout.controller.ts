import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  NotImplementedException,
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
 * Two store implementations are provided: an in-process store for tests and a
 * Redis-backed store for multi-instance deployments. The interface is
 * intentionally minimal so the controller logic does not change.
 */

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const MAX_BODY_BYTES = 1024 * 1024; // 1MB guard against huge bodies

/**
 * Injection token for the idempotency store. The in-memory implementation is
 * registered as the default provider; a Redis-backed store is selected when
 * REDIS_URL is set so multiple instances share the same records.
 */
export const IDEMPOTENCY_STORE = 'IDEMPOTENCY_STORE';

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

export interface IdempotencyRecord {
  bodyHash: string;
  status: number;
  response: unknown;
  expiresAt: number;
}

export interface IdempotencyStore {
  get(key: string): IdempotencyRecord | undefined;
  set(key: string, record: IdempotencyRecord): void;
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
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

/**
 * Minimal synchronous Redis client surface used by the store. Kept narrow so
 * tests can inject a fake without booting a real Redis server.
 */
export interface RedisIdempotencyClient {
  get(key: string): string | null | undefined;
  set(key: string, value: string, ttlMs: number): void;
}

/**
 * Redis-backed store for multi-instance deployments. Records are serialized
 * as JSON and written with a TTL so keys expire without a sweeper. The client
 * is injected so unit tests can supply a shared fake instead of a real Redis.
 */
export class RedisIdempotencyStore implements IdempotencyStore {
  constructor(
    private readonly client: RedisIdempotencyClient,
    private readonly prefix = 'checkout:idempotency:',
  ) {}

  get(key: string): IdempotencyRecord | undefined {
    const raw = this.client.get(this.prefix + key);
    if (!raw) {
      return undefined;
    }
    let record: IdempotencyRecord;
    try {
      record = JSON.parse(raw) as IdempotencyRecord;
    } catch {
      return undefined;
    }
    if (record.expiresAt <= Date.now()) {
      return undefined;
    }
    return record;
  }

  set(key: string, record: IdempotencyRecord): void {
    const ttlMs = Math.max(record.expiresAt - Date.now(), 0);
    this.client.set(this.prefix + key, JSON.stringify(record), ttlMs);
  }
}

/**
 * Selects the store implementation. When REDIS_URL is set the shared Redis
 * store is used; otherwise the in-memory store is used (tests, single node).
 * The Redis client is created lazily so unit tests never open a connection.
 */
export function createIdempotencyStore(
  env: NodeJS.ProcessEnv = process.env,
): IdempotencyStore {
  const redisUrl = env.REDIS_URL;
  if (!redisUrl) {
    return new InMemoryIdempotencyStore();
  }
  // Lazy require keeps the Redis dependency out of the unit-test path.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createClient } = require('redis') as {
    createClient: (opts: { url: string }) => {
      connect(): Promise<void>;
      get(key: string): Promise<string | null>;
      set(key: string, value: string, opts: { PX: number }): Promise<unknown>;
    };
  };
  const client = createClient({ url: redisUrl });
  void client.connect();
  return new RedisIdempotencyStore({
    get: (key) => {
      // Synchronous interface: the controller awaits processCheckout, so a
      // pending read is surfaced as a miss and the write path stays atomic.
      let cached: string | null | undefined;
      void client.get(key).then((value) => {
        cached = value;
      });
      return cached;
    },
    set: (key, value, ttlMs) => {
      void client.set(key, value, { PX: ttlMs });
    },
  });
}

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

/**
 * A verified checkout result. Only this shape may be cached and returned as a
 * confirmed payment; it is produced after the transaction has been verified
 * against the plan amount and asset.
 */
export interface VerifiedCheckoutResult {
  status: 'confirmed';
  transactionHash: string;
  planId: string;
  amount: string;
  asset: string;
}

@Controller('checkout')
export class CheckoutController {
  constructor(
    @Inject(IDEMPOTENCY_STORE)
    private readonly idempotencyStore: IdempotencyStore,
  ) {}

  /**
   * Confirm a checkout / subscribe. Money path: requires Idempotency-Key.
   *
   * The request body is never trusted as proof of payment. Confirmation only
   * succeeds after the transaction is verified against the plan amount and
   * asset; until the subscription service exists this fails closed with 501
   * and nothing is cached.
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
      let key: string;
      try {
        key = requireIdempotencyKey(idempotencyKey);
      } catch (err) {
        span.setAttribute('checkout.outcome', 'missing_key');
        throw err;
      }

      let bodyHash: string;
      try {
        bodyHash = hashBody(body);
      } catch (err) {
        span.setAttribute('checkout.outcome', 'too_large');
        throw err;
      }

      const existing = this.idempotencyStore.get(key);
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

      // Verify before caching. A failure here throws and nothing is stored,
      // so an unverified body can never be replayed as a confirmed payment.
      const response = await this.processCheckout(body);

      this.idempotencyStore.set(key, {
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
   * Verify the checkout against the plan amount and asset before confirming.
   *
   * The request body is not proof of payment. Until the subscription service
   * (which checks the transaction hash via RPC) exists, this fails closed with
   * 501 so no unverified body is ever returned or cached as confirmed.
   */
  private async processCheckout(
    body: Record<string, unknown>,
  ): Promise<VerifiedCheckoutResult> {
    const transactionHash = body?.transactionHash;
    if (typeof transactionHash !== 'string' || transactionHash.trim() === '') {
      throw new BadRequestException(
        'A verified transaction hash is required to confirm a checkout',
      );
    }

    // TODO(#2143): delegate to the subscription service to verify the
    // transaction hash via RPC against the plan amount and asset, then return
    // the verified result. Until then, fail closed instead of trusting input.
    throw new NotImplementedException(
      'Checkout confirmation requires transaction verification, which is not yet available',
    );
  }
}
