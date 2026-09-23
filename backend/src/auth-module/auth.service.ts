import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import { Keypair } from '@stellar/stellar-sdk';
import { RegisterDto } from './dto/register.dto';
import { UsersService } from '../users/users.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { EventBus } from '../events/event-bus';
import { UserLoggedInEvent } from '../events/domain-events';
import { isStellarAccountAddress } from '../common/utils/stellar-address';
import { RefreshTokenService, TokenPair } from './refresh-token.service';

/** Short TTL for issued challenges (ms). */
export const CHALLENGE_TTL_MS = 5 * 60 * 1000;

/** Max challenge issuances per window, per IP and per pubkey. */
export const CHALLENGE_RATE_LIMIT = 5;
export const CHALLENGE_RATE_WINDOW_MS = 60 * 1000;

export interface ChallengeRecord {
  pubkey: string;
  nonce: string;
  message: string;
  expiresAt: number;
}

export interface ChallengeResponse {
  pubkey: string;
  nonce: string;
  message: string;
  expiresAt: string;
}

@Injectable()
export class AuthService {
  private readonly challenges = new Map<string, ChallengeRecord>();
  private readonly rateBuckets = new Map<string, number[]>();

  constructor(
    private readonly usersService: UsersService,
    private readonly eventBus: EventBus,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly jwtService: JwtService,
  ) {}

  /** Rotates a refresh token for a new access+refresh pair (#1565). */
  async refresh(refreshToken: string): Promise<TokenPair> {
    return this.refreshTokenService.rotate(refreshToken);
  }

  validateStellarAddress(address: string): boolean {
    return isStellarAccountAddress(address);
  }

  /**
   * Issues a challenge message bound to the pubkey, a fresh nonce and a short
   * TTL. Rate limited per IP and per pubkey before any signature work (#1767).
   */
  issueChallenge(pubkey: string, ip?: string): ChallengeResponse {
    if (!this.validateStellarAddress(pubkey)) {
      throw new BadRequestException('Invalid Stellar address');
    }
    this.enforceChallengeRateLimit(`ip:${ip ?? 'unknown'}`);
    this.enforceChallengeRateLimit(`pubkey:${pubkey}`);

    const nonce = randomBytes(16).toString('hex');
    const expiresAt = Date.now() + CHALLENGE_TTL_MS;
    const message = [
      'Stellar challenge-login',
      `pubkey: ${pubkey}`,
      `nonce: ${nonce}`,
      `expiresAt: ${new Date(expiresAt).toISOString()}`,
    ].join('\n');

    const record: ChallengeRecord = { pubkey, nonce, message, expiresAt };
    this.challenges.set(nonce, record);
    this.pruneExpiredChallenges();

    return {
      pubkey,
      nonce,
      message,
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }

  /**
   * Verifies a signed challenge and issues a JWT with sub=pubkey and role.
   * The challenge is single-use and must not be expired.
   */
  async verifyChallenge(
    pubkey: string,
    nonce: string,
    signature: string,
  ): Promise<{ accessToken: string; pubkey: string; role: string }> {
    if (!this.validateStellarAddress(pubkey)) {
      throw new BadRequestException('Invalid Stellar address');
    }
    if (!nonce || !signature) {
      throw new BadRequestException('nonce and signature are required');
    }

    const record = this.challenges.get(nonce);
    if (!record || record.pubkey !== pubkey) {
      throw new UnauthorizedException('Unknown or mismatched challenge');
    }
    // Single-use: consume before verifying to prevent replay.
    this.challenges.delete(nonce);

    if (Date.now() > record.expiresAt) {
      throw new UnauthorizedException('Challenge expired');
    }

    let valid = false;
    try {
      const keypair = Keypair.fromPublicKey(pubkey);
      valid = keypair.verify(
        Buffer.from(record.message, 'utf8'),
        Buffer.from(signature, 'base64'),
      );
    } catch {
      valid = false;
    }
    if (!valid) {
      throw new UnauthorizedException('Invalid signature');
    }

    const role = await this.resolveRole(pubkey);
    const accessToken = await this.jwtService.signAsync(
      { sub: pubkey, role },
      {
        audience: 'stellar-auth',
        issuer: 'stellar-auth',
      },
    );

    this.eventBus.publish(new UserLoggedInEvent(pubkey, pubkey));

    return { accessToken, pubkey, role };
  }

  private async resolveRole(pubkey: string): Promise<string> {
    const user = await this.validateUser(pubkey);
    const role = (user as { role?: string } | null)?.role;
    return role ?? 'user';
  }

  private enforceChallengeRateLimit(key: string): void {
    const now = Date.now();
    const windowStart = now - CHALLENGE_RATE_WINDOW_MS;
    const hits = (this.rateBuckets.get(key) ?? []).filter(
      (ts) => ts > windowStart,
    );
    if (hits.length >= CHALLENGE_RATE_LIMIT) {
      throw new BadRequestException(
        'Too many challenge requests, please retry later',
      );
    }
    hits.push(now);
    this.rateBuckets.set(key, hits);
  }

  private pruneExpiredChallenges(): void {
    const now = Date.now();
    for (const [nonce, record] of this.challenges) {
      if (record.expiresAt <= now) this.challenges.delete(nonce);
    }
  }

  createSession(stellarAddress: string) {
    if (!this.validateStellarAddress(stellarAddress)) {
      throw new BadRequestException('Invalid Stellar address');
    }
    const session = {
      userId: stellarAddress,
      token: Buffer.from(stellarAddress).toString('base64'),
    };
    this.eventBus.publish(
      new UserLoggedInEvent(session.userId, stellarAddress),
    );
    return session;
  }

  register(registerDto: RegisterDto) {
    void registerDto;
    throw new Error('Method not implemented.');
  }

  async validateUser(userId: string) {
    try {
      return await this.usersService.findOne(userId);
    } catch (e) {
      if (e instanceof NotFoundException) return null;
      throw e;
    }
  }

  async findById(id: string) {
    return this.usersService.findOne(id);
  }

  async findAllUsers(
    pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<any>> {
    const { data, total } = await this.usersService.findAll(pagination);
    const limit = pagination.limit ?? 20;
    const page = pagination.page ?? 1;
    const hasMore = page * limit < total;

    return new PaginatedResponseDto(data, limit, null, hasMore, page);
  }
}
