import {
  ConflictException,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { IdempotencyKey } from './idempotency-key.entity';

export interface CachedResponse {
  status: number;
  body: unknown;
}

/**
 * Default TTL: 24 hours (matches JWT expiry).
 * Override via IDEMPOTENCY_TTL_HOURS environment variable.
 */
const DEFAULT_TTL_MS =
  parseInt(process.env.IDEMPOTENCY_TTL_HOURS ?? '24', 10) * 60 * 60 * 1000;

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(
    @InjectRepository(IdempotencyKey)
    private readonly repo: Repository<IdempotencyKey>,
  ) {}

  /**
   * Attempt to acquire a new idempotency slot.
   *
   * - Returns `null`  → first time we see this key; caller should proceed normally.
   * - Returns `CachedResponse` → duplicate request; caller should replay the cached response.
   * - Throws `ConflictException` → first request is still in-flight (concurrent retry).
   */
  async acquire(
    key: string,
    fingerprint: string,
    method: string,
    path: string,
    ttlMs = DEFAULT_TTL_MS,
  ): Promise<CachedResponse | null> {
    const existing = await this.repo.findOne({
      where: { key, fingerprint },
    });

    if (existing) {
      // Expired record — treat as if it never existed (allow re-use).
      if (existing.expires_at < new Date()) {
        await this.repo.remove(existing);
        // Fall through to create a fresh record below.
      } else if (!existing.is_complete) {
        // First request is still processing — reject concurrent retry.
        throw new ConflictException(
          'A request with this Idempotency-Key is already being processed. Please wait and retry.',
        );
      } else {
        // Completed — guard against key reuse across different endpoints.
        if (existing.method !== method || existing.path !== path) {
          throw new UnprocessableEntityException(
            `Idempotency-Key "${key}" was already used for ${existing.method} ${existing.path}. ` +
              `It cannot be reused for ${method} ${path}.`,
          );
        }
        // Replay cached response.
        return {
          status: existing.response_status!,
          body: existing.response_body ? JSON.parse(existing.response_body) : null,
        };
      }
    }

    // Insert a new in-flight record. Use INSERT … ON CONFLICT DO NOTHING to
    // handle the race condition where two concurrent requests arrive simultaneously.
    try {
      const record = this.repo.create({
        key,
        fingerprint,
        method,
        path,
        is_complete: false,
        expires_at: new Date(Date.now() + ttlMs),
      });
      await this.repo.save(record);
    } catch (err: any) {
      // Unique constraint violation — another concurrent request won the race.
      if (err?.code === '23505') {
        throw new ConflictException(
          'A request with this Idempotency-Key is already being processed. Please wait and retry.',
        );
      }
      throw err;
    }

    return null; // first time — proceed with the real handler
  }

  /**
   * Persist the response for a completed request so future duplicates can
   * replay it without re-executing business logic.
   */
  async complete(
    key: string,
    fingerprint: string,
    status: number,
    body: unknown,
  ): Promise<void> {
    await this.repo.update(
      { key, fingerprint },
      {
        response_status: status,
        response_body: JSON.stringify(body),
        is_complete: true,
      },
    );
  }

  /**
   * Mark an in-flight record as failed (remove it) so the client can retry
   * with the same key after a server error.
   */
  async release(key: string, fingerprint: string): Promise<void> {
    await this.repo.delete({ key, fingerprint });
  }

  /**
   * Purge all expired records. Intended to be called by a scheduled job.
   * Returns the number of deleted rows.
   */
  async purgeExpired(): Promise<number> {
    const result = await this.repo.delete({
      expires_at: LessThan(new Date()),
    });
    const count = result.affected ?? 0;
    if (count > 0) {
      this.logger.log(`Purged ${count} expired idempotency key(s).`);
    }
    return count;
  }
}
