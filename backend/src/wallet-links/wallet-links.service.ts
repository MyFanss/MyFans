import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WalletLink } from './entities/wallet-link.entity';

@Injectable()
export class WalletLinksService {
  constructor(
    @InjectRepository(WalletLink)
    private readonly repo: Repository<WalletLink>,
  ) {}

  /**
   * Resolves a platform user's primary linked Stellar address, or `null` if
   * the user has none linked yet. Used to bridge a JWT identity into the
   * Stellar-address-keyed subscription index (see `ContentAccessService`).
   */
  async getPrimaryAddress(userId: string): Promise<string | null> {
    const primary = await this.repo.findOne({
      where: { user_id: userId, is_primary: true },
    });
    if (primary) return primary.stellar_address;

    const oldest = await this.repo.findOne({
      where: { user_id: userId },
      order: { created_at: 'ASC' },
    });
    return oldest?.stellar_address ?? null;
  }

  async listForUser(userId: string): Promise<WalletLink[]> {
    return this.repo.find({ where: { user_id: userId } });
  }

  /** Removes every wallet link for a user. Used on account deletion (#1566). */
  async deleteAllForUser(userId: string): Promise<void> {
    await this.repo.delete({ user_id: userId });
  }
}
