import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { Post } from './entities/post.entity';
import { CreatePostDto, PostDto, UpdatePostDto } from './dto';
import { PaginationDto, PaginatedResponseDto } from '../common/dto';
import { EventBus } from '../events/event-bus';
import { PostDeletedEvent } from '../events/domain-events';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepo: Repository<Post>,
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
    const [items, total] = await this.postRepo.findAndCount({
      where: { deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
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
    const [items, total] = await this.postRepo.findAndCount({
      where: { authorId, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
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

  async update(id: string, dto: UpdatePostDto): Promise<PostDto> {
    const post = await this.postRepo.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }
    Object.assign(post, dto);
    const saved = await this.postRepo.save(post);
    return this.toDto(saved);
  }

  /**
   * Soft-delete a post: sets deletedAt and deletedBy, then emits a
   * PostDeletedEvent for the audit trail.
   */
  async softDelete(id: string, deletedBy: string): Promise<void> {
    const post = await this.postRepo.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }
    post.deletedAt = new Date();
    post.deletedBy = deletedBy;
    await this.postRepo.save(post);
    this.eventBus.publish(new PostDeletedEvent(id, deletedBy));
  }

  /** @deprecated Use softDelete instead. Hard-deletes the post. */
  async remove(id: string): Promise<void> {
    const res = await this.postRepo.delete(id);
    if (!res.affected) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }
  }
}
