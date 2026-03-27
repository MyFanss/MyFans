import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment } from './entities/comment.entity';
import { Post, PostType } from '../posts/entities/post.entity';
import {
  Subscription,
  SubscriptionStatus,
} from '../subscriptions/entities/subscription.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { GetCommentsQueryDto } from './dto/get-comments-query.dto';
import { User } from '../users/entities/user.entity';
import { PaginatedResponseDto } from '../common/dto';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentRepo: Repository<Comment>,
    @InjectRepository(Post)
    private readonly postRepo: Repository<Post>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
  ) {}

  async create(user: User, postId: string, dto: CreateCommentDto) {
    const post = await this.postRepo.findOne({
      where: { id: postId },
      relations: ['creator'],
    });

    if (!post) {
      throw new NotFoundException(`Post with ID "${postId}" not found`);
    }

    await this.verifyPostAccess(user, post);

    const comment = this.commentRepo.create({
      body: dto.body,
      post_id: postId,
      user_id: user.id,
    });

    const saved = await this.commentRepo.save(comment);

    // Fetch again to include author info for the response
    const complete = await this.commentRepo.findOne({
      where: { id: saved.id },
      relations: ['user'],
    });

    return this.toResponse(complete!);
  }

  async findAll(postId: string, query: GetCommentsQueryDto) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const [comments, total] = await this.commentRepo.findAndCount({
      where: { post_id: postId },
      relations: ['user'],
      order: { created_at: 'DESC' },
      skip,
      take: limit,
    });

    return new PaginatedResponseDto(
      comments.map((c) => this.toResponse(c)),
      total,
      page,
      limit,
    );
  }

  async update(user: User, commentId: string, dto: UpdateCommentDto) {
    const comment = await this.commentRepo.findOne({
      where: { id: commentId },
      relations: ['user'],
    });

    if (!comment) {
      throw new NotFoundException(`Comment with ID "${commentId}" not found`);
    }

    if (comment.user_id !== user.id) {
      throw new ForbiddenException('Only the comment owner can update it');
    }

    comment.body = dto.body;
    const saved = await this.commentRepo.save(comment);
    return this.toResponse(saved);
  }

  async delete(user: User, commentId: string) {
    const comment = await this.commentRepo.findOne({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException(`Comment with ID "${commentId}" not found`);
    }

    if (comment.user_id !== user.id) {
      throw new ForbiddenException('Only the comment owner can delete it');
    }

    await this.commentRepo.remove(comment);
    return { success: true };
  }

  private async verifyPostAccess(user: User, post: Post) {
    // Designer note: Verify user has access to post before allowing comment.

    // 1. Owner (the creator) always has access
    if (post.creator.user_id === user.id) {
      return;
    }

    // 2. Drafts (published_at is null) are only visible to the owner
    if (!post.published_at) {
      throw new ForbiddenException('You do not have access to this draft post');
    }

    // 3. Free posts are visible to everyone
    if (post.type === PostType.FREE) {
      return;
    }

    // 4. Paid posts require an active subscription
    const sub = await this.subscriptionRepo.findOne({
      where: {
        fan: { id: user.id },
        creator: { id: post.creator.id },
        status: SubscriptionStatus.ACTIVE,
      },
    });

    if (!sub) {
      throw new ForbiddenException(
        'You must have an active subscription to comment on this post',
      );
    }
  }

  private toResponse(comment: Comment) {
    return {
      id: comment.id,
      post_id: comment.post_id,
      body: comment.body,
      created_at: comment.created_at,
      updated_at: comment.updated_at,
      author: {
        id: comment.user?.id,
        username: comment.user?.username,
        display_name: comment.user?.display_name,
        avatar_url: comment.user?.avatar_url,
      },
    };
  }
}
