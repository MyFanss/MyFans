import {
  Injectable,
  NotFoundException,
  Inject,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Post, PostType } from './entities/post.entity';
import { FindPostsQueryDto } from './dto/find-posts-query.dto';
import { Creator } from '../creators/entities/creator.entity';
import {
  Subscription,
  SubscriptionStatus,
} from '../subscriptions/entities/subscription.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PaginatedResponseDto } from '../common/dto';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepo: Repository<Post>,
    @InjectRepository(Creator)
    private readonly creatorRepo: Repository<Creator>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  private async invalidateCache() {
    try {
      const cacheAny = this.cacheManager as any;
      const store =
        cacheAny.store || (cacheAny.stores ? cacheAny.stores[0] : null);
      if (store && store.client && typeof store.client.keys === 'function') {
        const keys = await store.client.keys('*posts*');
        if (keys.length > 0) {
          await store.client.del(...keys);
        }
      } else {
        if (typeof cacheAny.reset === 'function') {
          await cacheAny.reset();
        } else if (typeof cacheAny.clear === 'function') {
          await cacheAny.clear();
        }
      }
    } catch (error) {
      console.error('Failed to invalidate posts cache:', error);
    }
  }

  async findAll(query: FindPostsQueryDto, userId?: string) {
    const { page = 1, limit = 20, creator_id, type } = query;
    const skip = (page - 1) * limit;

    const qb = this.postRepo
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.creator', 'creator')
      .orderBy('post.created_at', 'DESC');

    if (creator_id) {
      qb.andWhere('creator.id = :creator_id', { creator_id });
    }

    if (type) {
      qb.andWhere('post.type = :type', { type });
    }

    // Logic for drafts: if user is not the creator, only show published posts
    // If creator_id is not specified, we only show published posts for everyone
    if (creator_id) {
      const creator = await this.creatorRepo.findOne({
        where: { id: creator_id },
      });
      if (!creator || creator.user_id !== userId) {
        qb.andWhere('post.published_at IS NOT NULL');
      }
    } else {
      qb.andWhere('post.published_at IS NOT NULL');
    }

    const [items, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return new PaginatedResponseDto(items, total, page, limit);
  }

  async findOne(id: string, userId?: string) {
    const post = await this.postRepo.findOne({
      where: { id },
      relations: ['creator'],
    });

    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }

    // Creator can always see own posts
    if (userId && post.creator.user_id === userId) {
      return post;
    }

    // Draft check for non-creators
    if (!post.published_at) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }

    // Access Control for paid posts
    if (post.type === PostType.PAID) {
      if (!userId) {
        throw new ForbiddenException(
          'Active subscription required to view this post',
        );
      }

      const sub = await this.subscriptionRepo.findOne({
        where: {
          fan: { id: userId },
          creator: { id: post.creator.id },
          status: SubscriptionStatus.ACTIVE,
        },
      });

      if (!sub) {
        throw new ForbiddenException(
          'Active subscription required to view this post',
        );
      }
    }

    return post;
  }

  async create(userId: string, dto: CreatePostDto) {
    const creator = await this.creatorRepo.findOne({
      where: { user_id: userId },
    });
    if (!creator) {
      throw new ForbiddenException(`User ${userId} is not a creator`);
    }

    const post = this.postRepo.create({
      ...dto,
      creator,
    });
    const saved = await this.postRepo.save(post);
    await this.invalidateCache();
    return saved;
  }

  async update(id: string, dto: UpdatePostDto, userId?: string) {
    const post = await this.findOne(id, userId);

    // Ensure only the creator can update
    if (post.creator.user_id !== userId) {
      throw new ForbiddenException('Only the creator can update this post');
    }

    Object.assign(post, dto);
    const saved = await this.postRepo.save(post);
    await this.invalidateCache();
    return saved;
  }

  async delete(id: string, userId?: string) {
    const post = await this.findOne(id, userId);

    // Ensure only the creator can delete
    if (post.creator.user_id !== userId) {
      throw new ForbiddenException('Only the creator can delete this post');
    }

    await this.postRepo.remove(post);
    await this.invalidateCache();
    return { success: true };
  }
}
