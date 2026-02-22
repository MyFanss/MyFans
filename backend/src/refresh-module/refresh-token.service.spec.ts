import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { Repository, DeleteResult } from 'typeorm';
import * as crypto from 'crypto';

import { RefreshTokenService } from './refresh-token.service';
import { RefreshToken } from './refresh-token.entity';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const sha256 = (s: string) =>
  crypto.createHash('sha256').update(s).digest('hex');

const makeToken = (overrides: Partial<RefreshToken> = {}): RefreshToken =>
  ({
    id: 'token-uuid',
    userId: 'user-uuid',
    tokenHash: sha256('raw-token'),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24), // +1 day
    createdAt: new Date(),
    user: { id: 'user-uuid', email: 'test@example.com' } as any,
    ...overrides,
  } as RefreshToken);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RefreshTokenService', () => {
  let service: RefreshTokenService;
  let repo: jest.Mocked<Repository<RefreshToken>>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokenService,
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('signed-jwt') },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def?: any) => {
              const map: Record<string, any> = {
                JWT_REFRESH_TTL_DAYS: 30,
                JWT_ACCESS_EXPIRES_IN: 900,
              };
              return map[key] ?? def;
            }),
          },
        },
      ],
    }).compile();

    service = module.get(RefreshTokenService);
    repo = module.get(getRepositoryToken(RefreshToken));
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
  });

  // ── createRefreshToken ───────────────────────────────────────────────────

  describe('createRefreshToken', () => {
    it('stores a hashed token and returns the raw value', async () => {
      repo.create.mockReturnValue({} as any);
      repo.save.mockResolvedValue({} as any);

      const raw = await service.createRefreshToken('user-uuid');

      expect(typeof raw).toBe('string');
      expect(raw.length).toBeGreaterThan(0);

      // Ensure what was saved has the hash, not the raw token
      const created = repo.create.mock.calls[0][0] as any;
      expect(created.tokenHash).toBe(sha256(raw));
      expect(created.userId).toBe('user-uuid');
      expect(created.expiresAt).toBeInstanceOf(Date);
    });
  });

  // ── issueAccessToken ─────────────────────────────────────────────────────

  describe('issueAccessToken', () => {
    it('signs a JWT with sub and email', () => {
      const result = service.issueAccessToken('user-uuid', 'test@example.com');

      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: 'user-uuid', email: 'test@example.com' },
        { expiresIn: 900 },
      );
      expect(result.token).toBe('signed-jwt');
      expect(result.expiresIn).toBe(900);
    });
  });

  // ── rotate ───────────────────────────────────────────────────────────────

  describe('rotate', () => {
    it('returns new token pair when refresh token is valid', async () => {
      const stored = makeToken();
      repo.findOne.mockResolvedValue(stored);
      repo.delete.mockResolvedValue({ affected: 1 } as DeleteResult);
      repo.create.mockReturnValue({} as any);
      repo.save.mockResolvedValue({} as any);

      const result = await service.rotate('raw-token');

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { tokenHash: sha256('raw-token') },
        relations: ['user'],
      });
      // Old token deleted
      expect(repo.delete).toHaveBeenCalledWith(stored.id);
      expect(result.access_token).toBe('signed-jwt');
      expect(typeof result.refresh_token).toBe('string');
      expect(result.token_type).toBe('Bearer');
      expect(result.expires_in).toBe(900);
    });

    it('throws 401 when token not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.rotate('unknown-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws 401 and deletes record when token is expired', async () => {
      const expired = makeToken({
        expiresAt: new Date(Date.now() - 1000), // past
      });
      repo.findOne.mockResolvedValue(expired);
      repo.delete.mockResolvedValue({ affected: 1 } as DeleteResult);

      await expect(service.rotate('raw-token')).rejects.toThrow(
        UnauthorizedException,
      );
      // Expired record should be cleaned up
      expect(repo.delete).toHaveBeenCalledWith(expired.id);
    });
  });

  // ── invalidate ───────────────────────────────────────────────────────────

  describe('invalidate', () => {
    it('deletes token by hash', async () => {
      repo.delete.mockResolvedValue({ affected: 1 } as DeleteResult);

      await service.invalidate('raw-token');

      expect(repo.delete).toHaveBeenCalledWith({ tokenHash: sha256('raw-token') });
    });

    it('does not throw when token is already gone (idempotent)', async () => {
      repo.delete.mockResolvedValue({ affected: 0 } as DeleteResult);

      await expect(service.invalidate('ghost-token')).resolves.not.toThrow();
    });
  });

  // ── invalidateAll ────────────────────────────────────────────────────────

  describe('invalidateAll', () => {
    it('deletes all tokens for a user', async () => {
      repo.delete.mockResolvedValue({ affected: 5 } as DeleteResult);

      await service.invalidateAll('user-uuid');

      expect(repo.delete).toHaveBeenCalledWith({ userId: 'user-uuid' });
    });
  });

  // ── cleanExpiredTokens (cron) ────────────────────────────────────────────

  describe('cleanExpiredTokens', () => {
    it('deletes tokens where expiresAt is in the past', async () => {
      repo.delete.mockResolvedValue({ affected: 3 } as DeleteResult);

      await service.cleanExpiredTokens();

      const [where] = repo.delete.mock.calls[0];
      expect((where as any).expiresAt).toBeDefined();
    });
  });
});
