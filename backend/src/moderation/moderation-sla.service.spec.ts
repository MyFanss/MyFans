import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ModerationSlaService,
  SLA_THRESHOLDS_MS,
} from './moderation-sla.service';
import {
  ModerationFlag,
  ModerationStatus,
  ContentType,
  FlagReason,
} from './entities/moderation-flag.entity';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeFlag(
  status: ModerationStatus,
  ageMs: number,
  overrides: Partial<ModerationFlag> = {},
): Partial<ModerationFlag> {
  const queued_at = new Date(Date.now() - ageMs);
  return {
    id: Math.random().toString(36).slice(2),
    status,
    queued_at,
    created_at: queued_at,
    content_type: ContentType.POST,
    content_id: 'content-uuid',
    reason: FlagReason.SPAM,
    notes: null,
    reported_by: 'user-uuid',
    reviewed_by: null,
    reviewed_at: null,
    admin_notes: null,
    ...overrides,
  };
}

const mockFlagRepo = () => ({
  createQueryBuilder: jest.fn(),
});

// ── tests ─────────────────────────────────────────────────────────────────────

describe('ModerationSlaService', () => {
  let service: ModerationSlaService;
  let flagRepo: ReturnType<typeof mockFlagRepo>;

  /** Helper: configure the query builder mock to return `flags` */
  function mockQuery(flags: Partial<ModerationFlag>[]) {
    const qb = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(flags),
    };
    flagRepo.createQueryBuilder.mockReturnValue(qb);
    return qb;
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModerationSlaService,
        { provide: getRepositoryToken(ModerationFlag), useFactory: mockFlagRepo },
      ],
    }).compile();

    service = module.get(ModerationSlaService);
    flagRepo = module.get(getRepositoryToken(ModerationFlag));
  });

  // ── empty queue ─────────────────────────────────────────────────────────

  it('returns zero counts when queue is empty', async () => {
    mockQuery([]);
    const snap = await service.snapshot();

    expect(snap.openCount).toBe(0);
    expect(snap.byStatus).toHaveLength(2); // PENDING + UNDER_REVIEW
    for (const s of snap.byStatus) {
      expect(s.count).toBe(0);
      expect(s.avgAgeMs).toBe(0);
      expect(s.p95AgeMs).toBe(0);
      expect(s.overdueCount).toBe(0);
    }
  });

  // ── basic counts ────────────────────────────────────────────────────────

  it('counts flags per status correctly', async () => {
    const ONE_HOUR = 60 * 60 * 1000;
    mockQuery([
      makeFlag(ModerationStatus.PENDING, ONE_HOUR),
      makeFlag(ModerationStatus.PENDING, ONE_HOUR * 2),
      makeFlag(ModerationStatus.UNDER_REVIEW, ONE_HOUR * 5),
    ]);

    const snap = await service.snapshot();
    expect(snap.openCount).toBe(3);

    const pending = snap.byStatus.find((s) => s.status === ModerationStatus.PENDING)!;
    expect(pending.count).toBe(2);

    const underReview = snap.byStatus.find((s) => s.status === ModerationStatus.UNDER_REVIEW)!;
    expect(underReview.count).toBe(1);
  });

  // ── overdue detection ───────────────────────────────────────────────────

  it('marks PENDING flags overdue after 4 h', async () => {
    const FOUR_H = SLA_THRESHOLDS_MS.PENDING_OVERDUE_MS;
    mockQuery([
      makeFlag(ModerationStatus.PENDING, FOUR_H - 1000),  // within SLO
      makeFlag(ModerationStatus.PENDING, FOUR_H + 1000),  // overdue
      makeFlag(ModerationStatus.PENDING, FOUR_H + 5000),  // overdue
    ]);

    const snap = await service.snapshot();
    const pending = snap.byStatus.find((s) => s.status === ModerationStatus.PENDING)!;
    expect(pending.overdueCount).toBe(2);
    expect(pending.sloThresholdMs).toBe(FOUR_H);
  });

  it('marks UNDER_REVIEW flags overdue after 24 h', async () => {
    const TWENTY_FOUR_H = SLA_THRESHOLDS_MS.UNDER_REVIEW_OVERDUE_MS;
    mockQuery([
      makeFlag(ModerationStatus.UNDER_REVIEW, TWENTY_FOUR_H - 1000),
      makeFlag(ModerationStatus.UNDER_REVIEW, TWENTY_FOUR_H + 1000),
    ]);

    const snap = await service.snapshot();
    const ur = snap.byStatus.find((s) => s.status === ModerationStatus.UNDER_REVIEW)!;
    expect(ur.overdueCount).toBe(1);
    expect(ur.sloThresholdMs).toBe(TWENTY_FOUR_H);
  });

  // ── percentile accuracy ─────────────────────────────────────────────────

  it('computes correct p95 and p99 ages', async () => {
    // 100 PENDING flags with ages 1 min … 100 min
    const ONE_MIN = 60 * 1000;
    const flags = Array.from({ length: 100 }, (_, i) =>
      makeFlag(ModerationStatus.PENDING, (i + 1) * ONE_MIN),
    );
    mockQuery(flags);

    const snap = await service.snapshot();
    const pending = snap.byStatus.find((s) => s.status === ModerationStatus.PENDING)!;

    // p95 of [1..100] min → 95 min
    expect(pending.p95AgeMs).toBeCloseTo(95 * ONE_MIN, -3);
    // p99 → 99 min
    expect(pending.p99AgeMs).toBeCloseTo(99 * ONE_MIN, -3);
  });

  // ── null queued_at fallback ─────────────────────────────────────────────

  it('falls back to created_at when queued_at is null', async () => {
    const TWO_HOURS = 2 * 60 * 60 * 1000;
    const flag = makeFlag(ModerationStatus.PENDING, TWO_HOURS);
    (flag as any).queued_at = null; // simulate legacy row
    (flag as any).created_at = new Date(Date.now() - TWO_HOURS);
    mockQuery([flag]);

    const snap = await service.snapshot();
    const pending = snap.byStatus.find((s) => s.status === ModerationStatus.PENDING)!;
    // avgAgeMs should be approximately 2 h (allow 1 s tolerance)
    expect(pending.avgAgeMs).toBeGreaterThanOrEqual(TWO_HOURS - 1000);
    expect(pending.avgAgeMs).toBeLessThanOrEqual(TWO_HOURS + 1000);
  });

  // ── collectedAt is a valid ISO timestamp ────────────────────────────────

  it('sets collectedAt to a valid ISO string', async () => {
    mockQuery([]);
    const snap = await service.snapshot();
    expect(() => new Date(snap.collectedAt)).not.toThrow();
    expect(new Date(snap.collectedAt).toISOString()).toBe(snap.collectedAt);
  });

  // ── stale / disconnected state: clock skew guard ────────────────────────

  it('clamps negative ages to 0 (clock skew guard)', async () => {
    // queued_at slightly in the future (clock skew)
    const flag = makeFlag(ModerationStatus.PENDING, -500); // negative age
    mockQuery([flag]);

    const snap = await service.snapshot();
    const pending = snap.byStatus.find((s) => s.status === ModerationStatus.PENDING)!;
    expect(pending.avgAgeMs).toBeGreaterThanOrEqual(0);
    expect(pending.overdueCount).toBe(0);
  });
});
