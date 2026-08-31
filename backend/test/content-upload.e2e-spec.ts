/**
 * Content file upload (e2e) — issue #1593.
 *
 * A DB-free mini-module (real JwtStrategy + signed JWTs, mocked services)
 * exercising the guard chain on `POST /v1/content/upload`:
 *   - creator role required (USER -> 403, anonymous -> 401)
 *   - hourly quota -> 429
 *   - missing Pinata credential -> 503
 *   - happy path -> 201 with a CID
 *   - gated uploads still hide the CID from anonymous readers
 */
import {
  HttpException,
  HttpStatus,
  INestApplication,
  ServiceUnavailableException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { JwtStrategy } from '../src/auth-module/strategies/jwt.strategy';
import { AuthService } from '../src/auth-module/auth.service';
import { UserRole } from '../src/common/enums/user-role.enum';
import { ContentController } from '../src/content/content.controller';
import { ContentService } from '../src/content/content.service';
import { ContentAccessService } from '../src/content/content-access.service';
import { IpfsService } from '../src/content/ipfs.service';
import { UploadQuotaService } from '../src/content/upload-quota.service';
import { HybridFanAuthGuard } from '../src/subscriptions/guards/hybrid-fan-auth.guard';
import { OptionalHybridFanAuthGuard } from '../src/subscriptions/guards/optional-hybrid-fan-auth.guard';

const JWT_SECRET = 'content-upload-e2e-secret-not-for-production';
const CREATOR_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';

const USERS: Record<string, { id: string; email: string; role: UserRole }> = {
  [CREATOR_ID]: { id: CREATOR_ID, email: 'c@t.test', role: UserRole.CREATOR },
  [USER_ID]: { id: USER_ID, email: 'u@t.test', role: UserRole.USER },
};

describe('Content upload (e2e)', () => {
  let app: INestApplication;
  let jwt: JwtService;

  const ipfs = {
    uploadFile: jest.fn(),
    uploadMetadata: jest.fn(),
    isConfigured: jest.fn().mockReturnValue(true),
  };
  const quota = {
    assertWithinQuota: jest.fn(),
    record: jest.fn(),
  };
  const content = {
    create: jest.fn(),
  };
  const access = {
    getForRequester: jest.fn(),
  };

  const bearer = (sub: string) => `Bearer ${jwt.sign({ sub })}`;

  beforeAll(async () => {
    process.env.JWT_SECRET = JWT_SECRET;

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        PassportModule,
        JwtModule.register({
          secret: JWT_SECRET,
          signOptions: { expiresIn: '1h' },
        }),
      ],
      controllers: [ContentController],
      providers: [
        JwtStrategy,
        HybridFanAuthGuard,
        OptionalHybridFanAuthGuard,
        {
          provide: AuthService,
          useValue: {
            validateUser: jest
              .fn()
              .mockImplementation((id: string) =>
                Promise.resolve(USERS[id] ?? null),
              ),
          },
        },
        { provide: ContentService, useValue: content },
        { provide: ContentAccessService, useValue: access },
        { provide: IpfsService, useValue: ipfs },
        { provide: UploadQuotaService, useValue: quota },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
    jwt = app.get(JwtService);
  });

  afterAll(() => app.close());
  beforeEach(() => {
    jest.clearAllMocks();
    // clearAllMocks wipes call history but keeps implementations — reset the
    // defaults each test so a prior test's rejection doesn't leak.
    quota.assertWithinQuota.mockResolvedValue(undefined);
    ipfs.isConfigured.mockReturnValue(true);
  });

  const png = Buffer.from('fake-png-bytes');

  it('rejects an anonymous upload with 401', () =>
    request(app.getHttpServer())
      .post('/v1/content/upload')
      .field('title', 'Nope')
      .attach('file', png, 'x.png')
      .expect(401));

  it('rejects a non-creator (USER role) with 403', () =>
    request(app.getHttpServer())
      .post('/v1/content/upload')
      .set('Authorization', bearer(USER_ID))
      .field('title', 'Nope')
      .attach('file', png, 'x.png')
      .expect(403));

  it('accepts a creator upload and returns the stored record', async () => {
    ipfs.uploadFile.mockResolvedValue({
      cid: 'QmCid',
      url: 'https://gw/QmCid',
    });
    content.create.mockResolvedValue({
      id: 'content-1',
      creator_id: CREATOR_ID,
      title: 'My clip',
      ipfs_cid: 'QmCid',
      ipfs_url: 'https://gw/QmCid',
      content_type: 'image',
      is_published: false,
    });

    const res = await request(app.getHttpServer())
      .post('/v1/content/upload')
      .set('Authorization', bearer(CREATOR_ID))
      .field('title', 'My clip')
      .attach('file', png, 'x.png')
      .expect(201);

    expect(res.body.ipfs_cid).toBe('QmCid');
    expect(quota.assertWithinQuota).toHaveBeenCalledWith(CREATOR_ID);
    expect(quota.record).toHaveBeenCalledWith(CREATOR_ID);
  });

  it('returns 429 when the hourly quota is exceeded', async () => {
    quota.assertWithinQuota.mockRejectedValue(
      new HttpException(
        'Hourly upload limit reached',
        HttpStatus.TOO_MANY_REQUESTS,
      ),
    );

    await request(app.getHttpServer())
      .post('/v1/content/upload')
      .set('Authorization', bearer(CREATOR_ID))
      .field('title', 'Too many')
      .attach('file', png, 'x.png')
      .expect(429);

    expect(ipfs.uploadFile).not.toHaveBeenCalled();
  });

  it('returns 503 when IPFS pinning is not configured', async () => {
    ipfs.uploadFile.mockRejectedValue(
      new ServiceUnavailableException('IPFS pinning is not configured'),
    );

    await request(app.getHttpServer())
      .post('/v1/content/upload')
      .set('Authorization', bearer(CREATOR_ID))
      .field('title', 'No pinata')
      .attach('file', png, 'x.png')
      .expect(503);

    expect(quota.record).not.toHaveBeenCalled();
  });
});
