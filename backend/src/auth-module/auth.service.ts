import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Keypair } from '@stellar/stellar-sdk';
import { randomBytes } from 'crypto';

interface StoredChallenge {
  nonce: string;
  publicKey: string;
  expiresAt: number;
}

interface AuthUser {
  id: string;
  publicKey: string;
}

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly challenges = new Map<string, StoredChallenge>();
  private readonly users = new Map<string, AuthUser>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  issueChallenge(publicKey: string): { challenge: string; expiresAt: number } {
    this.pruneExpired();

    const nonce = randomBytes(32).toString('hex');
    const expiresAt = Date.now() + CHALLENGE_TTL_MS;
    const challenge = this.buildChallenge(publicKey, nonce);

    this.challenges.set(publicKey, { nonce, publicKey, expiresAt });

    return { challenge, expiresAt };
  }

  async verifyChallenge(
    publicKey: string,
    signature: string,
  ): Promise<{ accessToken: string }> {
    const stored = this.challenges.get(publicKey);

    if (!stored) {
      throw new UnauthorizedException('No active challenge for this key');
    }

    // Consume the challenge immediately so it cannot be replayed.
    this.challenges.delete(publicKey);

    if (Date.now() > stored.expiresAt) {
      throw new UnauthorizedException('Challenge has expired');
    }

    const challenge = this.buildChallenge(publicKey, stored.nonce);
    const isValid = this.verifySignature(publicKey, challenge, signature);

    if (!isValid) {
      throw new UnauthorizedException('Invalid signature');
    }

    const user = this.upsertUser(publicKey);
    const accessToken = await this.jwtService.signAsync({
      sub: publicKey,
      userId: user.id,
    });

    return { accessToken };
  }

  issueCsrfToken(publicKey: string): { csrfToken: string } {
    const csrfToken = randomBytes(24).toString('hex');
    return { csrfToken };
  }

  findById(id: string): AuthUser {
    const user = this.users.get(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private buildChallenge(publicKey: string, nonce: string): string {
    const network = this.configService.get<string>(
      'STELLAR_NETWORK',
      'testnet',
    );
    return `stellar-auth:${network}:${publicKey}:${nonce}`;
  }

  private verifySignature(
    publicKey: string,
    challenge: string,
    signature: string,
  ): boolean {
    try {
      const keypair = Keypair.fromPublicKey(publicKey);
      const message = Buffer.from(challenge, 'utf8');
      const signatureBuffer = Buffer.from(signature, 'base64');
      return keypair.verify(message, signatureBuffer);
    } catch {
      return false;
    }
  }

  private upsertUser(publicKey: string): AuthUser {
    for (const user of this.users.values()) {
      if (user.publicKey === publicKey) {
        return user;
      }
    }

    const user: AuthUser = { id: publicKey, publicKey };
    this.users.set(user.id, user);
    return user;
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [key, stored] of this.challenges.entries()) {
      if (now > stored.expiresAt) {
        this.challenges.delete(key);
      }
    }
  }
}
