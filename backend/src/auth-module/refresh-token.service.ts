import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomBytes, randomUUID, createHash } from 'crypto';
import { RefreshTokenEntity } from './entities/refresh-token.entity';
import { UsersService } from '../users/users.service';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface TokenSubject {
  id: string;
  email: string;
  token_version?: number | null;
}

const DEFAULT_REFRESH_TTL_DAYS = 30;

/**
 * Refresh-token rotation for the canonical `auth-module` (#1565). Deliberately
 * lives here rather than in the deprecated, unwired `refresh-module` (see
 * SECURITY.md Finding #6) — that tree stays untouched.
 *
 * Rotation model: every refresh token is single-use. Presenting a valid,
 * not-yet-rotated token issues a new access+refresh pair and marks the
 * presented token `revoked`. All tokens descending from the same original
 * issuance share a `family_id`; presenting a token that is already `revoked`
 * (i.e. it was already rotated away once) is treated as token theft/replay
 * and revokes every token in that family, forcing a full re-login.
 */
@Injectable()
export class RefreshTokenService {
  private readonly refreshTtlMs: number;

  constructor(
    @InjectRepository(RefreshTokenEntity)
    private readonly repo: Repository<RefreshTokenEntity>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    const days = Number(this.configService.get('REFRESH_TOKEN_TTL_DAYS'));
    this.refreshTtlMs =
      (Number.isFinite(days) && days > 0 ? days : DEFAULT_REFRESH_TTL_DAYS) *
      24 *
      60 *
      60 *
      1000;
  }

  private hash(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private signAccessToken(user: TokenSubject): string {
    return this.jwtService.sign({
      sub: user.id,
      email: user.email,
      tokenVersion: user.token_version ?? 0,
    });
  }

  /** Issues a brand-new access+refresh pair, starting a new token family (e.g. on login). */
  async issueTokenPair(user: TokenSubject): Promise<TokenPair> {
    return this.issuePairInFamily(user, randomUUID());
  }

  private async issuePairInFamily(
    user: TokenSubject,
    familyId: string,
  ): Promise<TokenPair> {
    const rawRefreshToken = randomBytes(48).toString('hex');
    await this.repo.save(
      this.repo.create({
        user_id: user.id,
        token_hash: this.hash(rawRefreshToken),
        family_id: familyId,
        revoked: false,
        expires_at: new Date(Date.now() + this.refreshTtlMs),
      }),
    );

    return {
      accessToken: this.signAccessToken(user),
      refreshToken: rawRefreshToken,
    };
  }

  /**
   * Validates the presented refresh token and rotates it. Throws
   * `UnauthorizedException` if the token is unknown, expired, belongs to a
   * deleted user, or has already been rotated away (reuse detection — in
   * that case the whole family is revoked before throwing).
   */
  async rotate(presentedRefreshToken: string): Promise<TokenPair> {
    const tokenHash = this.hash(presentedRefreshToken);
    const existing = await this.repo.findOne({ where: { token_hash: tokenHash } });

    if (!existing) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (existing.revoked) {
      // Reuse of a token that was already rotated away: treat as
      // compromised and kill the entire family.
      await this.repo.update({ family_id: existing.family_id }, { revoked: true });
      throw new UnauthorizedException(
        'Refresh token reuse detected; all sessions in this family were revoked',
      );
    }

    if (existing.expires_at.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    let user: TokenSubject;
    try {
      user = await this.usersService.findOne(existing.user_id);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    existing.revoked = true;
    await this.repo.save(existing);

    return this.issuePairInFamily(user, existing.family_id);
  }
}
