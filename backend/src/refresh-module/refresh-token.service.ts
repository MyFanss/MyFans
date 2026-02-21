import {
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as crypto from 'crypto';
import { RefreshToken } from './refresh-token.entity';

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /** SHA-256 hash of a raw token string */
  private hashToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  /** Generate a cryptographically secure random token (URL-safe base64) */
  private generateRawToken(): string {
    return crypto.randomBytes(48).toString('base64url');
  }

  // ─── Core Operations ──────────────────────────────────────────────────────

  /**
   * Persist a new hashed refresh token for a user.
   * Called at login (or after a successful refresh rotation).
   */
  async createRefreshToken(userId: string): Promise<string> {
    const raw = this.generateRawToken();
    const hash = this.hashToken(raw);

    const ttlDays = this.config.get<number>('JWT_REFRESH_TTL_DAYS', 30);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + ttlDays);

    const entity = this.refreshTokenRepo.create({ userId, tokenHash: hash, expiresAt });
    await this.refreshTokenRepo.save(entity);

    return raw; // Return the raw token to the client; only the hash is stored
  }

  /**
   * Generate an access token JWT for a given user.
   */
  issueAccessToken(userId: string, email: string): { token: string; expiresIn: number } {
    const expiresIn = this.config.get<number>('JWT_ACCESS_EXPIRES_IN', 900); // 15 min default
    const token = this.jwtService.sign(
      { sub: userId, email },
      { expiresIn },
    );
    return { token, expiresIn };
  }

  /**
   * Exchange a valid raw refresh token for a new token pair.
   * Old token is deleted (rotation) to prevent reuse.
   */
  async rotate(rawToken: string): Promise<TokenPair & { userId: string; email: string }> {
    const hash = this.hashToken(rawToken);

    const stored = await this.refreshTokenRepo.findOne({
      where: { tokenHash: hash },
      relations: ['user'],
    });

    if (!stored) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (stored.expiresAt < new Date()) {
      // Clean up the expired record
      await this.refreshTokenRepo.delete(stored.id);
      throw new UnauthorizedException('Refresh token has expired');
    }

    // Delete the old token (rotation)
    await this.refreshTokenRepo.delete(stored.id);

    // Issue new pair
    const newRawRefresh = await this.createRefreshToken(stored.userId);
    const { token: access_token, expiresIn } = this.issueAccessToken(
      stored.userId,
      stored.user.email,
    );

    return {
      access_token,
      refresh_token: newRawRefresh,
      token_type: 'Bearer',
      expires_in: expiresIn,
      userId: stored.userId,
      email: stored.user.email,
    };
  }

  /**
   * Invalidate a single refresh token (logout from current device).
   */
  async invalidate(rawToken: string): Promise<void> {
    const hash = this.hashToken(rawToken);
    const result = await this.refreshTokenRepo.delete({ tokenHash: hash });

    if (result.affected === 0) {
      // Token not found – treat as already logged out (idempotent)
      this.logger.warn('Logout attempted with unknown or already-invalidated token');
    }
  }

  /**
   * Invalidate all refresh tokens for a user (logout from all devices).
   */
  async invalidateAll(userId: string): Promise<void> {
    await this.refreshTokenRepo.delete({ userId });
    this.logger.log(`All refresh tokens invalidated for user ${userId}`);
  }

  // ─── Scheduled Cleanup ────────────────────────────────────────────────────

  /**
   * Purge expired refresh tokens every day at midnight.
   * Requires ScheduleModule.forRoot() in AppModule.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanExpiredTokens(): Promise<void> {
    const result = await this.refreshTokenRepo.delete({
      expiresAt: LessThan(new Date()),
    });
    this.logger.log(`Cleaned up ${result.affected ?? 0} expired refresh token(s)`);
  }
}
