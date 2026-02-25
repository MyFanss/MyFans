import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Like } from './entities/like.entity';
import { PostsService } from '../posts/posts.service';

@Injectable()
export class LikesService {
  constructor(
    @InjectRepository(Like)
    private readonly likesRepository: Repository<Like>,
    private readonly postsService: PostsService,
  ) {}

  /**
   * Add a like to a post (idempotent)
   * Returns 201 if created, 200 if already exists
   */
  async addLike(
    postId: string,
    userId: string,
  ): Promise<{ status: number; message: string }> {
    // Verify post exists and get author info
    const post = await this.postsService.findOneWithLikes(postId);

    // Verify user has access to the post (free or subscribed)
    await this.checkUserAccess(postId, userId, post.authorId, post.isPremium);

    // Check if like already exists (idempotent)
    const existingLike = await this.likesRepository.findOne({
      where: { userId, postId },
    });

    if (existingLike) {
      // Already liked - idempotent behavior
      return { status: 200, message: 'Post already liked' };
    }

    // Create new like
    const like = this.likesRepository.create({ userId, postId });
    await this.likesRepository.save(like);

    // Increment likes count on post
    await this.postsService.incrementLikesCount(postId);

    return { status: 201, message: 'Like added successfully' };
  }

  /**
   * Remove a like from a post
   * Returns 204 on success
   */
  async removeLike(postId: string, userId: string): Promise<void> {
    // Verify post exists
    await this.postsService.findOne(postId);

    const like = await this.likesRepository.findOne({
      where: { userId, postId },
    });

    if (!like) {
      throw new NotFoundException('Like not found');
    }

    await this.likesRepository.remove(like);

    // Decrement likes count on post
    await this.postsService.decrementLikesCount(postId);
  }

  /**
   * Get likes count for a post
   */
  async getLikesCount(postId: string): Promise<number> {
    return this.likesRepository.count({ where: { postId } });
  }

  /**
   * Check if user has liked a post
   */
  async hasUserLiked(postId: string, userId: string): Promise<boolean> {
    const like = await this.likesRepository.findOne({
      where: { userId, postId },
    });
    return !!like;
  }

  /**
   * Verify user has access to the post
   * - If post is free (not requiring subscription), allow like
   * - If post requires subscription, check if user is subscribed
   */
  private async checkUserAccess(
    postId: string,
    userId: string,
    authorId: string,
    isPremium: boolean,
  ): Promise<void> {
    // For premium posts, we would check subscription
    // This is a placeholder for the subscription check
    // In a real implementation, you would check:
    // if (isPremium && !this.subscriptionsService.isSubscriber(userId, authorId)) {
    //   throw new ForbiddenException('You must subscribe to like this premium post');
    // }

    // For now, allow all users to like posts
    // The subscription check can be added when premium posts are implemented
  }
}
