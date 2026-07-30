import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import * as request from 'supertest';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersService } from '../users/users.service';

const TEST_SECRET = 'e2e-test-secret';

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  username: 'testuser',
  role: 'USER',
};

describe('Auth Module (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const mockUsersService = {
    findOne: jest.fn(),
    findAll: jest.fn(),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({ JWT_SECRET: TEST_SECRET })],
        }),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
          secret: TEST_SECRET,
          signOptions: { expiresIn: '1h' },
        }),
      ],
      controllers: [AuthController],
      providers: [
        AuthService,
        JwtStrategy,
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    jwtService = module.get(JwtService);
  });

  afterAll(() => app.close());

  afterEach(() => jest.clearAllMocks());

  function getAccessToken(userId: string) {
    return jwtService.sign({ sub: userId, email: mockUser.email });
  }

  describe('GET /v1/auth/users', () => {
    it('returns 401 without a bearer token', async () => {
      const { status } = await request(app.getHttpServer()).get('/v1/auth/users');
      expect(status).toBe(401);
    });

    it('returns paginated users with valid token', async () => {
      mockUsersService.findOne.mockResolvedValue(mockUser);
      mockUsersService.findAll.mockResolvedValue({
        data: [mockUser],
        total: 1,
      });

      const token = getAccessToken(mockUser.id);

      const { status, body } = await request(app.getHttpServer())
        .get('/v1/auth/users?limit=10&page=1')
        .set('Authorization', `Bearer ${token}`);

      expect(status).toBe(200);
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('limit');
      expect(body).toHaveProperty('hasMore');
    });

    it('returns 401 with an invalid token', async () => {
      const { status } = await request(app.getHttpServer())
        .get('/v1/auth/users')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(status).toBe(401);
    });
  });

  describe('GET /v1/auth/profile', () => {
    it('returns 401 without a bearer token', async () => {
      const { status } = await request(app.getHttpServer()).get(
        '/v1/auth/profile',
      );
      expect(status).toBe(401);
    });

    it('returns the current user profile with valid token', async () => {
      mockUsersService.findOne.mockResolvedValue(mockUser);

      const token = getAccessToken(mockUser.id);

      const { status, body } = await request(app.getHttpServer())
        .get('/v1/auth/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(status).toBe(200);
      expect(body).toHaveProperty('id', mockUser.id);
      expect(body).toHaveProperty('email', mockUser.email);
    });
  });
});
