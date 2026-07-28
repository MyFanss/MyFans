import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { Post } from './entities/post.entity';
import { PostAuditLog } from './entities/post-audit-log.entity';
import { CreatePostDto, PostDto, UpdatePostDto } from './dto';
import { PaginationDto, PaginatedResponseDto } from '../common/dto';
import { EventBus } from '../events/event-bus';
import { PostDeletedEvent } from '../events/domain-events';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepo: Repository<Post>,
    @InjectRepository(PostAuditLog)
    private readonly auditRepo: Repository<PostAuditLog>,
    private readonly eventBus: EventBus,
  ) {}

  private toDto(post: Post): PostDto {
    return plainToInstance(PostDto, post, { excludeExtraneousValues: true });
  }

  async create(authorId: string, dto: CreatePostDto): Promise<PostDto> {
    const entity = this.postRepo.create({
      title: dto.title,
      content: dto.content,
      authorId,
      isPublished: dto.isPublished ?? false,
      isPremium: dto.isPremium ?? false,
    });
    const saved = await this.postRepo.save(entity);
    return this.toDto(saved);
  }

  async findAll(
    pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<PostDto>> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const skip = (page - 1) * limit;

    const [items, total] = await this.postRepo.findAndCount({
      where: { deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return new PaginatedResponseDto(
      items.map((p) => this.toDto(p)),
      total,
      page,
      limit,
    );
  }

  async findByAuthor(
    authorId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<PostDto>> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const skip = (page - 1) * limit;

    const [items, total] = await this.postRepo.findAndCount({
      where: { authorId, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return new PaginatedResponseDto(
      items.map((p) => this.toDto(p)),
      total,
      page,
      limit,
    );
  }

  async findOne(id: string): Promise<PostDto> {
    const post = await this.postRepo.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }
    return this.toDto(post);
  }

  /**
   * Only the post's author may update it. Moderator/admin takedowns go
   * through the separate `/moderation` flow (see ModerationController),
   * not this endpoint.
   */
  async update(
    id: string,
    dto: UpdatePostDto,
    requesterId: string,
  ): Promise<PostDto> {
    const post = await this.postRepo.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }
    if (post.authorId !== requesterId) {
      throw new ForbiddenException(
        'You do not have permission to update this post',
      );
    }
    Object.assign(post, dto);
    const saved = await this.postRepo.save(post);
    return this.toDto(saved);
  }

  /**
   * Soft-delete a post: sets deletedAt and deletedBy, persists an audit log
   * row, then emits a PostDeletedEvent for downstream consumers.
   *
   * Idempotent guard: throws NotFoundException if the post is already deleted
   * or does not exist, so callers cannot double-delete. Only the post's
   * author may delete it; admin takedowns go through `/moderation`.
   */
  async softDelete(id: string, deletedBy: string): Promise<void> {
    const post = await this.postRepo.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }
    if (post.authorId !== deletedBy) {
      throw new ForbiddenException(
        'You do not have permission to delete this post',
      );
    }

    post.deletedAt = new Date();
    post.deletedBy = deletedBy;
    await this.postRepo.save(post);

    await this.auditRepo.save(
      this.auditRepo.create({ postId: id, deletedBy, action: 'soft_delete' }),
    );

    this.eventBus.publish(new PostDeletedEvent(id, deletedBy));
  }

  /** @deprecated Use softDelete instead. Hard-deletes the post. */
  async remove(id: string): Promise<void> {
    const res = await this.postRepo.delete(id);
    if (!res.affected) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }
  }

  /**
   * Cursor-paginated, published, non-deleted posts authored by any of
   * `authorIds`, newest first. Used by the fan feed to aggregate posts from
   * subscribed creators. Returns an empty page when `authorIds` is empty
   * rather than querying with an empty IN clause.
   */
  async findFeed(
    authorIds: string[],
    cursor?: string,
    limit = 20,
  ): Promise<PaginatedResponseDto<PostDto>> {
    if (authorIds.length === 0) {
      return new PaginatedResponseDto([], limit, null, false);
    }

    const qb = this.postRepo
      .createQueryBuilder('post')
      .where('post.authorId IN (:...authorIds)', { authorIds })
      .andWhere('post.isPublished = :isPublished', { isPublished: true })
      .andWhere('post.deletedAt IS NULL')
      .orderBy('post.createdAt', 'DESC')
      .addOrderBy('post.id', 'DESC')
      .take(limit + 1);

    const decoded = cursor ? this.decodeFeedCursor(cursor) : null;
    if (decoded) {
      qb.andWhere(
        '(post.createdAt < :cCreatedAt OR (post.createdAt = :cCreatedAt AND post.id < :cId))',
        { cCreatedAt: decoded.createdAt, cId: decoded.id },
      );
    }

    const rows = await qb.getMany();
    const hasMore = rows.length > limit;
    if (hasMore) {
      rows.pop();
    }

    const nextCursor =
      rows.length > 0 ? this.encodeFeedCursor(rows[rows.length - 1]) : null;

    return new PaginatedResponseDto(
      rows.map((p) => this.toDto(p)),
      limit,
      nextCursor,
      hasMore,
    );
  }

  private encodeFeedCursor(post: Post): string {
    return Buffer.from(`${post.createdAt.toISOString()}|${post.id}`).toString(
      'base64',
    );
  }

  private decodeFeedCursor(
    cursor: string,
  ): { createdAt: string; id: string } | null {
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf8');
      const [createdAt, id] = decoded.split('|');
      if (!createdAt || !id) return null;
      return { createdAt, id };
    } catch {
      return null;
    }
  }
}
