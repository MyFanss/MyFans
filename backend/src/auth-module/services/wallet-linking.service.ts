import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Keypair } from '@stellar/stellar-sdk';
import { UserWalletLink } from '../entities/user-wallet-link.entity';
import { WalletChallenge } from '../../auth/wallet-challenge.entity';
import { EventBus } from '../../events/event-bus';
import { UserLoggedInEvent } from '../../events/domain-events';

const CHALLENGE_TTL_SECONDS = 300; // 5 minutes

@Injectable()
export class WalletLinkingService {
  constructor(
    @InjectRepository(UserWalletLink)
    private readonly walletLinkRepo: Repository<UserWalletLink>,
    @InjectRepository(WalletChallenge)
    private readonly challengeRepo: Repository<WalletChallenge>,
    private readonly eventBus: EventBus,
  ) {}

  async createChallenge(address: string): Promise<{ nonce: string; expiresAt: Date }> {
    const nonce = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_SECONDS * 1000);

    const challenge = this.challengeRepo.create({
      stellarAddress: address,
      nonce,
      expiresAt,
    });
    await this.challengeRepo.save(challenge);

    return { nonce, expiresAt };
  }

  async verifyAndLinkWallet(
    userId: string,
    address: string,
    nonce: string,
    signatureHex: string,
  ): Promise<{ id: string; stellarAddress: string; verifiedAt: Date }> {
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

    // Mark challenge as used (prevents replay)
    challenge.used = true;
    await this.challengeRepo.save(challenge);

    // Check if address is already linked to a different user
    const existingLink = await this.walletLinkRepo.findOne({
      where: { stellarAddress: address },
    });

    if (existingLink && existingLink.userId !== userId) {
      throw new ConflictException(
        'This Stellar address is already linked to another user',
      );
    }

    const verifiedAt = new Date();

    // Create or update the wallet link for this user
    let link: UserWalletLink;
    if (existingLink) {
      existingLink.verifiedAt = verifiedAt;
      link = await this.walletLinkRepo.save(existingLink);
    } else {
      // If this is the user's first wallet link, make it primary
      const existingLinks = await this.walletLinkRepo.find({ where: { userId } });
      const isPrimary = existingLinks.length === 0;

      link = this.walletLinkRepo.create({
        userId,
        stellarAddress: address,
        verifiedAt,
        isPrimary,
      });
      link = await this.walletLinkRepo.save(link);
    }

    this.eventBus.publish(new UserLoggedInEvent(userId, address));

    return { id: link.id, stellarAddress: link.stellarAddress, verifiedAt };
  }

  async getPrimaryWalletLink(
    userId: string,
  ): Promise<UserWalletLink | null> {
    return this.walletLinkRepo.findOne({
      where: { userId, isPrimary: true },
    });
  }

  async getWalletLinks(userId: string): Promise<UserWalletLink[]> {
    return this.walletLinkRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async unlinkWallet(userId: string, walletLinkId: string): Promise<void> {
    const link = await this.walletLinkRepo.findOne({
      where: { id: walletLinkId, userId },
    });

    if (!link) {
      throw new BadRequestException('Wallet link not found');
    }

    // Prevent unlinking the only wallet
    const allLinks = await this.walletLinkRepo.find({ where: { userId } });
    if (allLinks.length === 1) {
      throw new BadRequestException(
        'Cannot unlink your only wallet. Add another wallet first.',
      );
    }

    await this.walletLinkRepo.remove(link);

    // If we just deleted the primary, promote the next one
    if (link.isPrimary) {
      const nextLink = allLinks.find((l) => l.id !== link.id);
      if (nextLink) {
        nextLink.isPrimary = true;
        await this.walletLinkRepo.save(nextLink);
      }
    }
  }
}
