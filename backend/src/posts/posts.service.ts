import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { Post } from './entities/post.entity';
import { PostDto, CreatePostDto, UpdatePostDto } from './dto';
import { PaginationDto, PaginatedResponseDto } from '../common/dto';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
  ) {}

  private toDto(post: Post): PostDto {
    return plainToInstance(PostDto, post, { excludeExtraneousValues: true });
  }

  async create(authorId: string, dto: CreatePostDto): Promise<PostDto> {
    const post = this.postsRepository.create({
      ...dto,
      authorId,
      likesCount: 0,
    });
    const saved = await this.postsRepository.save(post);
    return this.toDto(saved);
  }

  async findAll(pagination: PaginationDto): Promise<PaginatedResponseDto<PostDto>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const [posts, total] = await this.postsRepository.findAndCount({
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return new PaginatedResponseDto(
      posts.map((p) => this.toDto(p)),
      total,
      page,
      limit,
    );
  }

  async findByAuthor(authorId: string, pagination: PaginationDto): Promise<PaginatedResponseDto<PostDto>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const [posts, total] = await this.postsRepository.findAndCount({
      where: { authorId },
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return new PaginatedResponseDto(
      posts.map((p) => this.toDto(p)),
      total,
      page,
      limit,
    );
  }

  async findOne(id: string): Promise<PostDto> {
    const post = await this.postsRepository.findOne({ where: { id } });
    if (!post) {
      throw new NotFoundException(`Post with id "${id}" not found`);
    }
    return this.toDto(post);
  }

  async findOneWithLikes(id: string): Promise<Post> {
    const post = await this.postsRepository.findOne({ 
      where: { id },
      relations: ['likes'],
    });
    if (!post) {
      throw new NotFoundException(`Post with id "${id}" not found`);
    }
    return post;
  }

  async update(id: string, dto: UpdatePostDto): Promise<PostDto> {
    const post = await this.postsRepository.findOne({ where: { id } });
    if (!post) {
      throw new NotFoundException(`Post with id "${id}" not found`);
    }
    Object.assign(post, dto);
    const updated = await this.postsRepository.save(post);
    return this.toDto(updated);
  }

  async remove(id: string): Promise<void> {
    const post = await this.postsRepository.findOne({ where: { id } });
    if (!post) {
      throw new NotFoundException(`Post with id "${id}" not found`);
    }
    await this.postsRepository.remove(post);
  }

  async incrementLikesCount(id: string): Promise<void> {
    await this.postsRepository.increment({ id }, 'likesCount', 1);
  }

  async decrementLikesCount(id: string): Promise<void> {
    await this.postsRepository.decrement({ id }, 'likesCount', 1);
  }
}
