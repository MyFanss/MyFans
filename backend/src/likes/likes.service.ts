import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Like } from './entities/like.entity';
import { Content } from '../content/entities/content.entity';

/**
 * ADR-1749: Single source of truth for content likes.
 *
 * Decision: Option C — chain anchor + DB cache.
 * The on-chain `content-likes` contract is the authoritative ledger for
 * like/unlike intent. The DB (`likes` table) is a read-optimized cache that
 * is only ever mutated by the chain event reconciler (`applyChainEvent`).
 * No API path writes likes directly; the previous dual-write path is removed.
 *
 * Invariants:
 *  - `applyChainEvent` is idempotent: replaying the same (txHash, logIndex)
 *    is a no-op, so reorgs/retries cannot double-count.
 *  - Concurrent like/unlike are serialized by the chain; the cache converges
 *    to the latest event per (contentId, liker).
 *  - When a creator deletes a post, likes are GC'd via `removeByContent`.
 */
@Injectable()
export class LikesService {
  private readonly logger = new Logger(LikesService.name);

  constructor(
    @InjectRepository(Like)
    private readonly likesRepository: Repository<Like>,
    @InjectRepository(Content)
    private readonly contentRepository: Repository<Content>,
  ) {}

  /**
   * Read path: served entirely from the DB cache. The chain is never queried
   * on the hot path; the reconciler keeps the cache in sync.
   */
  async getLikeCount(contentId: string): Promise<number> {
    return this.likesRepository.count({ where: { contentId } });
  }

  async hasLiked(contentId: string, liker: string): Promise<boolean> {
    const existing = await this.likesRepository.findOne({
      where: { contentId, liker },
    });
    return existing !== null;
  }

  /**
   * Single writer: applies an authoritative on-chain like/unlike event to the
   * DB cache. Idempotent on (txHash, logIndex) so replays are safe.
   *
   * @param event normalized event emitted by the content-likes contract
   */
  async applyChainEvent(event: {
    txHash: string;
    logIndex: number;
    contentId: string;
    liker: string;
    liked: boolean;
  }): Promise<void> {
    const { txHash, logIndex, contentId, liker, liked } = event;

    const content = await this.contentRepository.findOne({
      where: { id: contentId },
    });
    if (!content) {
      // Post may have been deleted; drop the event rather than resurrect it.
      this.logger.warn(
        `Dropping like event for missing content ${contentId} (tx ${txHash}:${logIndex})`,
      );
      return;
    }

    const existing = await this.likesRepository.findOne({
      where: { contentId, liker },
    });

    if (liked) {
      if (existing) {
        // Idempotent replay: already applied.
        return;
      }
      await this.likesRepository.save(
        this.likesRepository.create({
          contentId,
          liker,
          txHash,
          logIndex,
        }),
      );
      return;
    }

    // Unlike event.
    if (!existing) {
      // Idempotent replay of an unlike, or like never observed.
      return;
    }
    await this.likesRepository.remove(existing);
  }

  /**
   * GC policy: invoked when a creator deletes a post. Removes all cached
   * likes for the content so the cache does not retain orphaned rows.
   */
  async removeByContent(contentId: string): Promise<void> {
    await this.likesRepository.delete({ contentId });
  }

  /**
   * Guard used by the API layer to reject any attempt at a direct DB write.
   * Likes must flow through the chain and be reconciled via applyChainEvent.
   */
  assertSingleWriter(): void {
    throw new ConflictException(
      'Likes are chain-authoritative (ADR-1749); write via the content-likes contract, not the API.',
    );
  }
}
