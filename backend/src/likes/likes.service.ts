import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Like } from './like.entity';
import { Post } from '../posts/post.entity';
import { Comment } from '../comments/comment.entity';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class LikesService {
  constructor(
    @InjectRepository(Like)
    private readonly likesRepository: Repository<Like>,
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    @InjectRepository(Comment)
    private readonly commentsRepository: Repository<Comment>,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  /**
   * Idempotently like a target. A repeated like by the same user does not
   * create a duplicate row, so the ledger count never inflates.
   */
  async like(userId: string, targetId: string): Promise<{ liked: boolean; count: number }> {
    await this.assertTargetAccessible(userId, targetId);

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
    await this.assertTargetAccessible(userId, targetId);

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

  /**
   * Resolve the target through the Post then Comment repositories and reject
   * the operation when the target is subscriber-gated and the caller is not an
   * active subscriber.
   */
  private async assertTargetAccessible(userId: string, targetId: string): Promise<void> {
    const post = await this.postsRepository.findOne({ where: { id: targetId } });
    if (post) {
      if (post.isGated) {
        await this.assertSubscriber(userId);
      }
      return;
    }

    const comment = await this.commentsRepository.findOne({ where: { id: targetId } });
    if (comment) {
      if (comment.isGated) {
        await this.assertSubscriber(userId);
      }
      return;
    }

    throw new NotFoundException(`Target ${targetId} not found`);
  }

  private async assertSubscriber(userId: string): Promise<void> {
    const isActive = await this.subscriptionsService.checkSubscription(userId);
    if (!isActive) {
      throw new ForbiddenException('An active subscription is required to like this content');
    }
  }
}
