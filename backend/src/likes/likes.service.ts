import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Like } from './like.entity';

@Injectable()
export class LikesService {
  constructor(
    @InjectRepository(Like)
    private readonly likesRepository: Repository<Like>,
  ) {}

  /**
   * Idempotently like a target. A repeated like by the same user does not
   * create a duplicate row, so the ledger count never inflates.
   */
  async like(userId: string, targetId: string): Promise<{ liked: boolean; count: number }> {
    const existing = await this.likesRepository.findOne({
      where: { userId, targetId },
    });

    if (!existing) {
      const like = this.likesRepository.create({ userId, targetId });
      await this.likesRepository.save(like);
    }

    return { liked: true, count: await this.count(targetId) };
  }

  /**
   * Idempotently unlike a target. Unliking something that was never liked is a
   * no-op rather than an error, per the content-likes ADR.
   */
  async unlike(userId: string, targetId: string): Promise<{ liked: boolean; count: number }> {
    await this.likesRepository.delete({ userId, targetId });

    return { liked: false, count: await this.count(targetId) };
  }

  /**
   * Count likes for a target from the ledger of like rows.
   */
  async count(targetId: string): Promise<number> {
    return this.likesRepository.count({ where: { targetId } });
  }

  /**
   * Whether the given user currently likes the target.
   */
  async hasLiked(userId: string, targetId: string): Promise<boolean> {
    const existing = await this.likesRepository.findOne({
      where: { userId, targetId },
    });

    return Boolean(existing);
  }
}
