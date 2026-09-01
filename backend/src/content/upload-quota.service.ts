import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThan, Repository } from 'typeorm';
import { MAX_UPLOADS_PER_CREATOR_PER_HOUR } from '../common/constants/body-upload-quotas';
import { ContentUploadEvent } from './entities/content-upload-event.entity';

const WINDOW_MS = 60 * 60 * 1000; // 1 hour

/**
 * Rolling hourly per-creator upload quota, backed by the
 * `content_upload_events` table so the count survives restarts and is
 * shared across instances (unlike an in-memory counter).
 */
@Injectable()
export class UploadQuotaService {
  private readonly logger = new Logger(UploadQuotaService.name);

  constructor(
    @InjectRepository(ContentUploadEvent)
    private readonly events: Repository<ContentUploadEvent>,
  ) {}

  /**
   * Throws HTTP 429 when the creator has already used their hourly upload
   * allowance. Call this *before* doing any expensive work (IPFS pinning).
   */
  async assertWithinQuota(creatorId: string): Promise<void> {
    const since = new Date(Date.now() - WINDOW_MS);
    const used = await this.events.count({
      where: { creator_id: creatorId, created_at: MoreThan(since) },
    });

    if (used >= MAX_UPLOADS_PER_CREATOR_PER_HOUR) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Hourly upload limit reached (${MAX_UPLOADS_PER_CREATOR_PER_HOUR}/hour). Try again later.`,
          error: 'Too Many Requests',
          retryAfterSeconds: Math.ceil(WINDOW_MS / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /** Record a completed upload against the creator's quota. */
  async record(creatorId: string): Promise<void> {
    await this.events.insert({ creator_id: creatorId });
  }

  /** Delete quota rows older than the window (with a safety margin). */
  async purgeExpired(): Promise<number> {
    const cutoff = new Date(Date.now() - 2 * WINDOW_MS);
    const result = await this.events.delete({ created_at: LessThan(cutoff) });
    return result.affected ?? 0;
  }
}
