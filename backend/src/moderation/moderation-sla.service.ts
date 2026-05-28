import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModerationFlag, ModerationStatus } from './entities/moderation-flag.entity';

/** SLO thresholds in milliseconds */
export const SLA_THRESHOLDS_MS = {
  /** Flags pending > 4 h are considered overdue */
  PENDING_OVERDUE_MS: 4 * 60 * 60 * 1000,
  /** Flags under_review > 24 h are considered overdue */
  UNDER_REVIEW_OVERDUE_MS: 24 * 60 * 60 * 1000,
} as const;

export interface StatusSlaStats {
  status: ModerationStatus;
  count: number;
  /** Average age in the current status (ms) */
  avgAgeMs: number;
  /** 95th-percentile age (ms) */
  p95AgeMs: number;
  /** 99th-percentile age (ms) */
  p99AgeMs: number;
  /** Oldest flag age (ms) */
  maxAgeMs: number;
  /** Flags exceeding the SLO threshold for this status */
  overdueCount: number;
  /** SLO threshold applied (ms) */
  sloThresholdMs: number;
}

export interface ModerationSlaSnapshot {
  collectedAt: string;
  /** Total flags currently in an open (non-terminal) status */
  openCount: number;
  byStatus: StatusSlaStats[];
}

/** Statuses that are still "in queue" and need SLA tracking */
const OPEN_STATUSES = [ModerationStatus.PENDING, ModerationStatus.UNDER_REVIEW];

const THRESHOLD_BY_STATUS: Record<string, number> = {
  [ModerationStatus.PENDING]: SLA_THRESHOLDS_MS.PENDING_OVERDUE_MS,
  [ModerationStatus.UNDER_REVIEW]: SLA_THRESHOLDS_MS.UNDER_REVIEW_OVERDUE_MS,
};

@Injectable()
export class ModerationSlaService {
  constructor(
    @InjectRepository(ModerationFlag)
    private readonly flagRepo: Repository<ModerationFlag>,
  ) {}

  /**
   * Compute a point-in-time SLA snapshot for the moderation queue.
   * Only open (non-terminal) statuses are included.
   * Flags with a null queued_at fall back to created_at for age calculation.
   */
  async snapshot(): Promise<ModerationSlaSnapshot> {
    const now = Date.now();

    // Fetch all open flags in a single query — only the columns we need
    const flags = await this.flagRepo
      .createQueryBuilder('flag')
      .select(['flag.status', 'flag.queued_at', 'flag.created_at'])
      .where('flag.status IN (:...statuses)', { statuses: OPEN_STATUSES })
      .getMany();

    // Group by status
    const grouped = new Map<ModerationStatus, ModerationFlag[]>();
    for (const status of OPEN_STATUSES) grouped.set(status, []);
    for (const flag of flags) {
      grouped.get(flag.status)?.push(flag);
    }

    const byStatus: StatusSlaStats[] = [];

    for (const status of OPEN_STATUSES) {
      const bucket = grouped.get(status) ?? [];
      const sloThresholdMs = THRESHOLD_BY_STATUS[status];

      if (bucket.length === 0) {
        byStatus.push({
          status,
          count: 0,
          avgAgeMs: 0,
          p95AgeMs: 0,
          p99AgeMs: 0,
          maxAgeMs: 0,
          overdueCount: 0,
          sloThresholdMs,
        });
        continue;
      }

      const ages = bucket
        .map((f) => now - (f.queued_at ?? f.created_at).getTime())
        .map((ms) => Math.max(0, ms)) // guard against clock skew
        .sort((a, b) => a - b);

      const avgAgeMs = Math.round(ages.reduce((s, v) => s + v, 0) / ages.length);
      const p95AgeMs = percentile(ages, 95);
      const p99AgeMs = percentile(ages, 99);
      const maxAgeMs = ages[ages.length - 1];
      const overdueCount = ages.filter((ms) => ms > sloThresholdMs).length;

      byStatus.push({
        status,
        count: bucket.length,
        avgAgeMs,
        p95AgeMs,
        p99AgeMs,
        maxAgeMs,
        overdueCount,
        sloThresholdMs,
      });
    }

    return {
      collectedAt: new Date().toISOString(),
      openCount: flags.length,
      byStatus,
    };
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}
