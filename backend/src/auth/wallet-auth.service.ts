import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { Keypair } from '@stellar/stellar-sdk';
import { WalletChallenge } from './wallet-challenge.entity';
import { EventBus } from '../events/event-bus';
import { UserLoggedInEvent } from '../events/domain-events';

const CHALLENGE_TTL_SECONDS = 300; // 5 minutes

@Injectable()
export class WalletAuthService {
  constructor(
    @InjectRepository(WalletChallenge)
    private readonly challengeRepo: Repository<WalletChallenge>,
    private readonly jwtService: JwtService,
    private readonly eventBus: EventBus,
  ) {}

  async createChallenge(address: string): Promise<{ nonce: string; expiresAt: Date }> {
    const nonce = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_SECONDS * 1000);

    const challenge = this.challengeRepo.create({ stellarAddress: address, nonce, expiresAt });
    await this.challengeRepo.save(challenge);

    return { nonce, expiresAt };
  }

  async verifyAndIssueToken(
    address: string,
    nonce: string,
    signatureHex: string,
  ): Promise<{ access_token: string; token_type: string }> {
    const challenge = await this.challengeRepo.findOne({
      where: { stellarAddress: address, nonce },
    });

    if (!challenge) {
      throw new UnauthorizedException('Challenge not found');
    }

    if (challenge.used) {
      throw new UnauthorizedException('Challenge already used');
    }

    if (challenge.expiresAt < new Date()) {
      throw new UnauthorizedException('Challenge expired');
    }

    // Verify Ed25519 signature: wallet signs the raw nonce string
    try {
      const keypair = Keypair.fromPublicKey(address);
      const messageBytes = Buffer.from(nonce, 'utf8');
      const sigBytes = Buffer.from(signatureHex, 'hex');
      const valid = keypair.verify(messageBytes, sigBytes);
      if (!valid) throw new Error('bad sig');
    } catch {
      throw new BadRequestException('Invalid signature');
    }

    // Mark as used (prevents replay)
    challenge.used = true;
    await this.challengeRepo.save(challenge);

    const access_token = this.jwtService.sign({ sub: address });

    this.eventBus.publish(new UserLoggedInEvent(address, address));

    return { access_token, token_type: 'Bearer' };
  }
}
