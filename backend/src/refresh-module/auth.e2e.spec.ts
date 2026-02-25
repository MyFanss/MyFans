/**
 * Integration test – spins up a real NestJS app with an in-memory SQLite DB.
 * Run with: jest --testPathPattern=auth.e2e
 *
 * Dependencies (dev): @nestjs/testing, supertest, better-sqlite3 (or sqlite3), typeorm
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as request from 'supertest';
import * as crypto from 'crypto';

import { RefreshToken } from './refresh-token.entity';
import { User } from '../users-module/user.entity';
import { RefreshTokenService } from './refresh-token.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';

const TEST_SECRET = 'test-secret-key';
const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

describe('Auth Refresh Flow (Integration)', () => {
  let app: INestApplication;
  let tokenService: RefreshTokenService;
  let savedUserId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              JWT_SECRET: TEST_SECRET,
              JWT_ACCESS_EXPIRES_IN: 900,
              JWT_REFRESH_TTL_DAYS: 30,
            }),
          ],
        }),
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [RefreshToken, User],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([RefreshToken, User]),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.registerAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (c: ConfigService) => ({
            secret: c.get('JWT_SECRET'),
            signOptions: { expiresIn: c.get('JWT_ACCESS_EXPIRES_IN') },
          }),
        }),
      ],
      controllers: [AuthController],
      providers: [RefreshTokenService, JwtStrategy],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    tokenService = module.get(RefreshTokenService);

    // Seed a user directly in the repo for testing
    const userRepo = module.get('UserRepository');
    const user = userRepo.create({ email: 'e2e@example.com', password: 'hashed' });
    const saved = await userRepo.save(user);
    savedUserId = saved.id;
  });

  afterAll(() => app.close());

  // ── Refresh ──────────────────────────────────────────────────────────────

  describe('POST /auth/refresh', () => {
    it('returns 200 with new token pair for a valid refresh token', async () => {
      const rawRefresh = await tokenService.createRefreshToken(savedUserId);

      const { body, status } = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: rawRefresh });

      expect(status).toBe(200);
      expect(body).toMatchObject({
        token_type: 'Bearer',
        expires_in: 900,
      });
      expect(typeof body.access_token).toBe('string');
      expect(typeof body.refresh_token).toBe('string');
      // New refresh token must differ from the old one
      expect(body.refresh_token).not.toBe(rawRefresh);
    });

    it('returns 401 when refresh token is unknown', async () => {
      const { status } = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: 'totally-made-up' });

      expect(status).toBe(401);
    });

    it('returns 401 when refresh token is reused (rotation enforcement)', async () => {
      const rawRefresh = await tokenService.createRefreshToken(savedUserId);

      // First use – succeeds
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: rawRefresh })
        .expect(200);

      // Second use of the same token – must fail
      const { status } = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: rawRefresh });

      expect(status).toBe(401);
    });

    it('returns 401 for an expired refresh token', async () => {
      const rawRefresh = await tokenService.createRefreshToken(savedUserId);

      // Manually expire the token in the DB
      const rtRepo = app.get('RefreshTokenRepository');
      await rtRepo.update(
        { tokenHash: sha256(rawRefresh) },
        { expiresAt: new Date(Date.now() - 1000) },
      );

      const { status } = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: rawRefresh });

      expect(status).toBe(401);
    });

    it('returns 400 when body is missing refresh_token', async () => {
      const { status } = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({});

      expect(status).toBe(400);
    });
  });

  // ── Logout ───────────────────────────────────────────────────────────────

  describe('POST /auth/logout', () => {
    const getAccessToken = async (userId: string, email: string) =>
      tokenService.issueAccessToken(userId, email).token;

    it('returns 204 and invalidates the refresh token', async () => {
      const rawRefresh = await tokenService.createRefreshToken(savedUserId);
      const accessToken = await getAccessToken(savedUserId, 'e2e@example.com');

      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refresh_token: rawRefresh })
        .expect(204);

      // Subsequent refresh with same token should fail
      const { status } = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: rawRefresh });

      expect(status).toBe(401);
    });

    it('invalidates all tokens when all_devices is true', async () => {
      const r1 = await tokenService.createRefreshToken(savedUserId);
      const r2 = await tokenService.createRefreshToken(savedUserId);
      const accessToken = await getAccessToken(savedUserId, 'e2e@example.com');

      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refresh_token: r1, all_devices: true })
        .expect(204);

      // Both tokens must be invalid now
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: r1 })
        .expect(401);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: r2 })
        .expect(401);
    });

    it('returns 401 when no Bearer token is provided', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .send({ refresh_token: 'anything' })
        .expect(401);
    });
  });
});
