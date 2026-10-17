/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
import {
  ExecutionContext,
  INestApplication,
  NestInterceptor,
  CallHandler,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { Observable } from 'rxjs';
import { AnalyticsController } from '../src/analytics/analytics.controller';
import { AnalyticsService } from '../src/analytics/analytics.service';

/**
 * Two fixture creator IDs used throughout the spec.
 * CREATOR_A makes requests against their own summary (allowed).
 * CREATOR_B makes requests against CREATOR_A's summary (forbidden).
 */
const CREATOR_A = 'creator-a';
const CREATOR_B = 'creator-b';

/**
 * Swap the authenticated user ID injected into req.user so we can test
 * authorization for different creators without a real JWT stack.
 */
let activeUserId = CREATOR_A;

/**
 * NestJS interceptor that stamps req.user before the controller reads it,
 * simulating the output of a real JWT guard.
 */
class InjectUserInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ user: { userId: string } }>();
    req.user = { userId: activeUserId };
    return next.handle();
  }
}

describe('AnalyticsController (e2e)', () => {
  let app: INestApplication;
  let analyticsService: AnalyticsService;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [AnalyticsService],
    }).compile();

    app = moduleRef.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalInterceptors(new InjectUserInterceptor());
    await app.init();

    analyticsService = moduleRef.get(AnalyticsService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    // Reset to CREATOR_A as the authenticated user before each test.
    activeUserId = CREATOR_A;
  });

  // ── Authentication ──────────────────────────────────────────────────────────

  it('rejects an unauthenticated request with 403', async () => {
    // Simulate no authenticated user — AnalyticsService throws ForbiddenException
    // when requesterId !== creatorId.
    activeUserId = 'unauthenticated';

    const res = await request(app.getHttpServer())
      .get(`/v1/analytics/${CREATOR_A}/summary`)
      .expect(403);

    expect(res.body).toHaveProperty('statusCode', 403);
  });

  // ── Authorization: cross-creator read ───────────────────────────────────────

  it('returns 403 when a creator requests another creator\'s summary', async () => {
    activeUserId = CREATOR_B;

    const res = await request(app.getHttpServer())
      .get(`/v1/analytics/${CREATOR_A}/summary`)
      .expect(403);

    expect(res.body).toHaveProperty('statusCode', 403);
  });

  // ── Empty state ─────────────────────────────────────────────────────────────

  it('returns isEmpty=true and zeroed counters when the creator has no events', async () => {
    activeUserId = CREATOR_A;

    // Use a fresh creator ID that has never had events recorded.
    const freshCreator = 'fresh-creator-empty';
    activeUserId = freshCreator;

    const res = await request(app.getHttpServer())
      .get(`/v1/analytics/${freshCreator}/summary`)
      .expect(200);

    const body = res.body as {
      isEmpty: boolean;
      mrrCents: number;
      activeSubscriptions: number;
      newSubscriptions: number;
      cancelledSubscriptions: number;
      uploads: number;
    };

    expect(body.isEmpty).toBe(true);
    expect(body.mrrCents).toBe(0);
    expect(body.activeSubscriptions).toBe(0);
    expect(body.newSubscriptions).toBe(0);
    expect(body.cancelledSubscriptions).toBe(0);
    expect(body.uploads).toBe(0);
  });

  // ── Seeded creator gets non-zero counters ───────────────────────────────────

  it('returns non-zero counters and isEmpty=false after events are recorded', async () => {
    const seededCreator = 'seeded-creator';
    activeUserId = seededCreator;

    // Seed events for the seeded creator.
    analyticsService.recordSubscribe(seededCreator, 'subscriber-ref-1', 999);
    analyticsService.recordSubscribe(seededCreator, 'subscriber-ref-2', 1999);
    analyticsService.recordUpload(seededCreator);

    const res = await request(app.getHttpServer())
      .get(`/v1/analytics/${seededCreator}/summary`)
      .expect(200);

    const body = res.body as {
      isEmpty: boolean;
      mrrCents: number;
      activeSubscriptions: number;
      uploads: number;
    };

    expect(body.isEmpty).toBe(false);
    expect(body.mrrCents).toBeGreaterThan(0);
    expect(body.activeSubscriptions).toBeGreaterThan(0);
  });

  // ── Response shape ───────────────────────────────────────────────────────────

  it('returns a response that includes all DashboardSummary fields', async () => {
    activeUserId = CREATOR_A;

    const res = await request(app.getHttpServer())
      .get(`/v1/analytics/${CREATOR_A}/summary`)
      .expect(200);

    expect(res.body).toHaveProperty('creatorId', CREATOR_A);
    expect(res.body).toHaveProperty('mrrCents');
    expect(res.body).toHaveProperty('activeSubscriptions');
    expect(res.body).toHaveProperty('newSubscriptions');
    expect(res.body).toHaveProperty('cancelledSubscriptions');
    expect(res.body).toHaveProperty('uploads');
    expect(res.body).toHaveProperty('periodStart');
    expect(res.body).toHaveProperty('periodEnd');
    expect(res.body).toHaveProperty('isEmpty');
  });
});
