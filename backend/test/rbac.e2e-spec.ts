/**
 * RBAC end-to-end coverage.
 *
 * Exercises the full guard chain the application wires globally in
 * `AppModule`: JwtAuthGuard (honouring `@Public()`) followed by RolesGuard
 * (enforcing `@Roles()`), against the real JWT strategy and real controllers.
 */
import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { App } from 'supertest/types';

import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { CreatorsController } from '../src/creators/creators.controller';
import { CreatorsService } from '../src/creators/creators.service';
import { CreatorDashboardService } from '../src/creators/creator-dashboard.service';
import { CreatorRegistrySyncService } from '../src/creators/creator-registry-sync.service';
import { AuthController } from '../src/auth-module/auth.controller';
import { JwtAuthGuard } from '../src/auth-module/guards/jwt-auth.guard';
import { RolesGuard } from '../src/auth-module/guards/roles.guard';
import { JwtStrategy } from '../src/auth-module/strategies/jwt.strategy';
import { AuthService } from '../src/auth-module/auth.service';
import { UserRole } from '../src/common/enums/user-role.enum';
import { UsersController } from '../src/users/users.controller';
import { UsersService } from '../src/users/users.service';
import { AdminAuditService } from '../src/admin-audit/admin-audit.service';
import { RequestContextService } from '../src/common/services/request-context.service';
import { ModerationController } from '../src/moderation/moderation.controller';
import { ModerationService } from '../src/moderation/moderation.service';
import { ModerationSlaService } from '../src/moderation/moderation-sla.service';
import { HealthController } from '../src/health/health.controller';
import { HealthService } from '../src/health/health.service';
import { FeatureFlagsController } from '../src/feature-flags/feature-flags.controller';
import { FeatureFlagsService } from '../src/feature-flags/feature-flags.service';

const JWT_SECRET = 'rbac-e2e-secret-not-for-production';

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const CREATOR_ID = '33333333-3333-4333-8333-333333333333';
const FLAG_ID = '44444444-4444-4444-8444-444444444444';
const VICTIM_ID = '55555555-5555-4555-8555-555555555555';

const USERS: Record<string, { id: string; email: string; role: UserRole }> = {
  [ADMIN_ID]: {
    id: ADMIN_ID,
    email: 'admin@myfans.test',
    role: UserRole.ADMIN,
  },
  [USER_ID]: { id: USER_ID, email: 'user@myfans.test', role: UserRole.USER },
  [CREATOR_ID]: {
    id: CREATOR_ID,
    email: 'creator@myfans.test',
    role: UserRole.CREATOR,
  },
};

describe('RBAC (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;

  const mockModerationService = {
    createFlag: jest.fn().mockResolvedValue({ id: FLAG_ID }),
    findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    findOne: jest.fn().mockResolvedValue({ id: FLAG_ID }),
    reviewFlag: jest.fn().mockResolvedValue({ id: FLAG_ID }),
    getAuditLog: jest.fn().mockResolvedValue([]),
  };
  const mockSlaService = { snapshot: jest.fn().mockResolvedValue({}) };
  const mockHealthService = {
    getHealth: jest.fn().mockReturnValue({ status: 'up', timestamp: 'now' }),
  };
  const mockFeatureFlagsService = {
    getAllFlags: jest.fn().mockReturnValue({}),
  };
  // #1626 — UsersService / audit / request-context mocks. `update` records the
  // id it was called with so the IDOR test can assert the controller only ever
  // passes the JWT subject, never a body/param-supplied id.
  const mockUsersService = {
    findOne: jest.fn().mockResolvedValue({
      id: USER_ID,
      email: 'user@myfans.test',
      role: UserRole.USER,
    }),
    update: jest
      .fn()
      .mockImplementation((id: string, dto: Record<string, unknown>) =>
        Promise.resolve({ id, ...dto }),
      ),
    updateRole: jest.fn().mockResolvedValue({
      user: { id: USER_ID, role: UserRole.CREATOR },
      previousRole: UserRole.USER,
    }),
    updateOnboarding: jest
      .fn()
      .mockImplementation((id: string, onboarding: Record<string, unknown>) =>
        Promise.resolve({ id, ...onboarding }),
      ),
    updateNotificationPreferences: jest
      .fn()
      .mockResolvedValue({ message: 'ok', preferences: {} }),
    validatePassword: jest.fn().mockResolvedValue(true),
    remove: jest.fn().mockResolvedValue(undefined),
  };
  const mockAdminAuditService = {
    record: jest.fn().mockResolvedValue({ id: 'audit-1' }),
  };
  const mockRequestContextService = {
    getCorrelationId: jest.fn().mockReturnValue('rbac-e2e-corr'),
  };
  // #1625 — registry sync mocks for the on-demand admin reconcile endpoint.
  const mockRegistrySyncService = {
    reconcile: jest.fn().mockResolvedValue({
      dryRun: false,
      scannedAt: new Date().toISOString(),
      totalScanned: 0,
      driftFound: 0,
      repaired: 0,
      errors: 0,
      records: [],
    }),
    syncOnOnboard: jest.fn().mockResolvedValue({ creator_id: CREATOR_ID }),
  };
  const mockCreatorsService = {
    searchCreators: jest.fn().mockResolvedValue({
      data: [],
      limit: 20,
      nextCursor: null,
      hasMore: false,
    }),
  };
  const mockDashboardService = {
    getDashboard: jest.fn().mockResolvedValue({}),
  };

  const token = (sub: string) => jwt.sign({ sub });
  const bearer = (sub: string) => `Bearer ${token(sub)}`;

  beforeAll(async () => {
    process.env.JWT_SECRET = JWT_SECRET;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
        PassportModule,
        JwtModule.register({
          secret: JWT_SECRET,
          signOptions: { expiresIn: '1h' },
        }),
      ],
      controllers: [
        ModerationController,
        HealthController,
        FeatureFlagsController,
        AuthController,
        UsersController,
        CreatorsController,
      ],
      providers: [
        JwtStrategy,
        {
          provide: AuthService,
          useValue: {
            validateUser: jest
              .fn()
              .mockImplementation((id: string) =>
                Promise.resolve(USERS[id] ?? null),
              ),
            findById: jest
              .fn()
              .mockImplementation((id: string) =>
                Promise.resolve(USERS[id] ?? null),
              ),
            findAllUsers: jest.fn().mockResolvedValue({
              data: [{ id: USER_ID, email: 'user@myfans.test' }],
              total: 1,
              limit: 20,
              page: 1,
              hasMore: false,
            }),
          },
        },
        { provide: ModerationService, useValue: mockModerationService },
        { provide: ModerationSlaService, useValue: mockSlaService },
        { provide: HealthService, useValue: mockHealthService },
        { provide: FeatureFlagsService, useValue: mockFeatureFlagsService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: AdminAuditService, useValue: mockAdminAuditService },
        { provide: RequestContextService, useValue: mockRequestContextService },
        { provide: CreatorsService, useValue: mockCreatorsService },
        { provide: CreatorDashboardService, useValue: mockDashboardService },
        {
          provide: CreatorRegistrySyncService,
          useValue: mockRegistrySyncService,
        },
        {
          provide: ThrottlerGuard,
          useValue: { canActivate: jest.fn(() => true) },
        },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();

    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  // ── Admin-only routes ──────────────────────────────────────────────────

  const ADMIN_ROUTES: [string, 'get' | 'patch', string][] = [
    ['list flags', 'get', '/v1/moderation/flags'],
    ['read a flag', 'get', `/v1/moderation/flags/${FLAG_ID}`],
    ['read a flag audit trail', 'get', `/v1/moderation/flags/${FLAG_ID}/audit`],
    ['read queue SLA metrics', 'get', '/v1/moderation/sla'],
  ];

  describe.each(ADMIN_ROUTES)('%s (%s %s)', (_name, method, path) => {
    it('rejects an anonymous request with 401', () =>
      request(app.getHttpServer())[method](path).expect(401));

    it('rejects a USER JWT with 403', () =>
      request(app.getHttpServer())
        [method](path)
        .set('Authorization', bearer(USER_ID))
        .expect(403));

    it('rejects a CREATOR JWT with 403', () =>
      request(app.getHttpServer())
        [method](path)
        .set('Authorization', bearer(CREATOR_ID))
        .expect(403));

    it('accepts an ADMIN JWT with 200', () =>
      request(app.getHttpServer())
        [method](path)
        .set('Authorization', bearer(ADMIN_ID))
        .expect(200));
  });

  describe('PATCH /v1/moderation/flags/:id/review', () => {
    const body = { status: 'under_review' };

    it('rejects a USER JWT with 403', () =>
      request(app.getHttpServer())
        .patch(`/v1/moderation/flags/${FLAG_ID}/review`)
        .set('Authorization', bearer(USER_ID))
        .send(body)
        .expect(403));

    it('accepts an ADMIN JWT with 200', () =>
      request(app.getHttpServer())
        .patch(`/v1/moderation/flags/${FLAG_ID}/review`)
        .set('Authorization', bearer(ADMIN_ID))
        .send(body)
        .expect(200));
  });

  // ── Users routes (#1626) ────────────────────────────────────────────────

  describe('GET /v1/auth/users (admin-only user list)', () => {
    it('rejects an anonymous request with 401', () =>
      request(app.getHttpServer()).get('/v1/auth/users').expect(401));

    it('rejects a USER JWT with 403', () =>
      request(app.getHttpServer())
        .get('/v1/auth/users')
        .set('Authorization', bearer(USER_ID))
        .expect(403));

    it('rejects a CREATOR JWT with 403', () =>
      request(app.getHttpServer())
        .get('/v1/auth/users')
        .set('Authorization', bearer(CREATOR_ID))
        .expect(403));

    it('accepts an ADMIN JWT with 200', () =>
      request(app.getHttpServer())
        .get('/v1/auth/users')
        .set('Authorization', bearer(ADMIN_ID))
        .expect(200));
  });

  describe('PATCH /v1/users/:id/role (admin-only role change)', () => {
    const body = { role: 'CREATOR' };

    it('rejects an anonymous request with 401', () =>
      request(app.getHttpServer())
        .patch(`/v1/users/${USER_ID}/role`)
        .send(body)
        .expect(401));

    it('rejects a USER JWT with 403 (cannot escalate own role)', () =>
      request(app.getHttpServer())
        .patch(`/v1/users/${USER_ID}/role`)
        .set('Authorization', bearer(USER_ID))
        .send(body)
        .expect(403));

    it('rejects a CREATOR JWT with 403', () =>
      request(app.getHttpServer())
        .patch(`/v1/users/${CREATOR_ID}/role`)
        .set('Authorization', bearer(CREATOR_ID))
        .send(body)
        .expect(403));

    it('accepts an ADMIN JWT with 200', () =>
      request(app.getHttpServer())
        .patch(`/v1/users/${USER_ID}/role`)
        .set('Authorization', bearer(ADMIN_ID))
        .send(body)
        .expect(200));
  });

  describe('IDOR fail-closed (#1626): self-service routes are scoped to the JWT subject', () => {
    it('PATCH /v1/users/me always targets the JWT subject, ignoring a spoofed body id', async () => {
      mockUsersService.update.mockClear();

      await request(app.getHttpServer())
        .patch('/v1/users/me')
        .set('Authorization', bearer(USER_ID))
        .send({ id: VICTIM_ID, displayName: 'Spoofed' })
        .expect(200);

      expect(mockUsersService.update).toHaveBeenCalledWith(
        USER_ID,
        expect.objectContaining({ displayName: 'Spoofed' }),
      );
      // The victim id must never reach the service layer.
      expect(mockUsersService.update).not.toHaveBeenCalledWith(
        VICTIM_ID,
        expect.anything(),
      );
    });

    it('PATCH /v1/users/me is rejected without authentication', () =>
      request(app.getHttpServer())
        .patch('/v1/users/me')
        .send({ displayName: 'Anon' })
        .expect(401));

    it('there is no cross-user mutation route: PATCH /v1/users/:id returns 404', () =>
      request(app.getHttpServer())
        .patch(`/v1/users/${VICTIM_ID}`)
        .set('Authorization', bearer(USER_ID))
        .send({ displayName: 'Hack' })
        .expect(404));

    it('there is no cross-user read route: GET /v1/users/:id returns 404', () =>
      request(app.getHttpServer())
        .get(`/v1/users/${VICTIM_ID}`)
        .set('Authorization', bearer(USER_ID))
        .expect(404));
  });

  // ── Creator registry reconcile (#1625) ──────────────────────────────────

  describe('POST /v1/creators/registry/reconcile (admin-only)', () => {
    it('rejects an anonymous request with 401', () =>
      request(app.getHttpServer())
        .post('/v1/creators/registry/reconcile')
        .expect(401));

    it('rejects a USER JWT with 403', () =>
      request(app.getHttpServer())
        .post('/v1/creators/registry/reconcile')
        .set('Authorization', bearer(USER_ID))
        .expect(403));

    it('rejects a CREATOR JWT with 403', () =>
      request(app.getHttpServer())
        .post('/v1/creators/registry/reconcile')
        .set('Authorization', bearer(CREATOR_ID))
        .expect(403));

    it('accepts an ADMIN JWT and runs a live reconcile (dryRun defaults to env/false)', async () => {
      mockRegistrySyncService.reconcile.mockClear();

      await request(app.getHttpServer())
        .post('/v1/creators/registry/reconcile')
        .set('Authorization', bearer(ADMIN_ID))
        .expect(201);

      expect(mockRegistrySyncService.reconcile).toHaveBeenCalledWith(false);
    });

    it('passes ?dryRun=true through to the reconcile call', async () => {
      mockRegistrySyncService.reconcile.mockClear();

      await request(app.getHttpServer())
        .post('/v1/creators/registry/reconcile?dryRun=true')
        .set('Authorization', bearer(ADMIN_ID))
        .expect(201);

      expect(mockRegistrySyncService.reconcile).toHaveBeenCalledWith(true);
    });
  });

  // ── Authenticated, non-admin routes ────────────────────────────────────

  describe('POST /v1/moderation/flags (any authenticated user)', () => {
    const body = {
      content_type: 'post',
      content_id: FLAG_ID,
      reason: 'spam',
    };

    it('rejects an anonymous request with 401', () =>
      request(app.getHttpServer())
        .post('/v1/moderation/flags')
        .send(body)
        .expect(401));

    it('accepts a USER JWT', () =>
      request(app.getHttpServer())
        .post('/v1/moderation/flags')
        .set('Authorization', bearer(USER_ID))
        .send(body)
        .expect(201));
  });

  // ── Public routes ──────────────────────────────────────────────────────

  describe('routes marked @Public()', () => {
    it('GET /v1/health is reachable without a JWT', () =>
      request(app.getHttpServer())
        .get('/v1/health')
        .expect(200)
        .expect((res) => {
          expect((res.body as { status: string }).status).toBe('up');
        }));

    it('GET /v1/feature-flags is reachable without a JWT', () =>
      request(app.getHttpServer()).get('/v1/feature-flags').expect(200));

    it('GET /v1/health still works when a JWT is supplied', () =>
      request(app.getHttpServer())
        .get('/v1/health')
        .set('Authorization', bearer(USER_ID))
        .expect(200));

    it('GET /v1/health is not blocked by an invalid JWT', () =>
      request(app.getHttpServer())
        .get('/v1/health')
        .set('Authorization', 'Bearer not-a-real-token')
        .expect(200));
  });

  // ── Token validity ─────────────────────────────────────────────────────

  describe('token validation on protected routes', () => {
    it('rejects a malformed bearer token with 401', () =>
      request(app.getHttpServer())
        .get('/v1/moderation/flags')
        .set('Authorization', 'Bearer not-a-real-token')
        .expect(401));

    it('rejects a well-formed token for an unknown user with 401', () =>
      request(app.getHttpServer())
        .get('/v1/moderation/flags')
        .set('Authorization', bearer('00000000-0000-4000-8000-000000000000'))
        .expect(401));
  });
});
