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

const DEFAULT_BATCH_SIZE =
  parseInt(process.env.IDEMPOTENCY_CLEANUP_BATCH_SIZE ?? '1000', 10);

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
    // Look up by key alone first so we can detect body-hash mismatches.
    const existing = await this.repo.findOne({ where: { key } });

    if (existing) {
      // Expired record — treat as if it never existed (allow re-use).
      if (existing.expires_at < new Date()) {
        await this.repo.remove(existing);
        // Fall through to create a fresh record below.
      } else if (existing.fingerprint !== fingerprint) {
        // Same key but different fingerprint (different user or different
        // request body). The fingerprint now includes a SHA-256 hash of the
        // request body, so this catches payload-mismatch reuse.
        throw new ConflictException(
          'Idempotency-Key has already been used with a different request body or by a different caller.',
        );
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
   * Purge expired records in batches to avoid long-running deletes.
   * Returns the total number of deleted rows across all batches.
   */
  async purgeExpired(batchSize = DEFAULT_BATCH_SIZE): Promise<number> {
    let totalDeleted = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const expired = await this.repo.find({
        where: { expires_at: LessThan(new Date()) },
        select: ['id'],
        take: batchSize,
      });

      if (expired.length === 0) break;

      const ids = expired.map((r) => r.id);
      const result = await this.repo.delete(ids);
      totalDeleted += result.affected ?? 0;

      if (expired.length < batchSize) break;
    }

    if (totalDeleted > 0) {
      this.logger.log(`Purged ${totalDeleted} expired idempotency key(s).`);
    }
    return totalDeleted;
  }
}
