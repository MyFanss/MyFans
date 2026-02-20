import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Post, PostType } from './entities/post.entity';
import { FindPostsQueryDto } from './dto/find-posts-query.dto';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepo: Repository<Post>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  private async invalidateCache() {
    try {
      const cacheAny = this.cacheManager as any;
      const store = cacheAny.store || (cacheAny.stores ? cacheAny.stores[0] : null);
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


  async findAll(query: FindPostsQueryDto) {
    const { page = 1, limit = 20, creator_id, type } = query;
    const skip = (page - 1) * limit;

    const qb = this.postRepo.createQueryBuilder('post')
      .leftJoinAndSelect('post.creator', 'creator')
      .orderBy('post.created_at', 'DESC');

    if (creator_id) {
      qb.andWhere('creator.id = :creator_id', { creator_id });
    }

    if (type) {
      qb.andWhere('post.type = :type', { type });
    }

    const [items, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const post = await this.postRepo.findOne({
      where: { id },
      relations: ['creator'],
    });
    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }
    return post;
  }

  async create(creator: any, data: any) {
    const post = this.postRepo.create({
      ...data,
      creator,
    });
    const saved = await this.postRepo.save(post);
    await this.invalidateCache();
    return saved;
  }

  async update(id: string, data: any) {
    const post = await this.findOne(id);
    Object.assign(post, data);
    const saved = await this.postRepo.save(post);
    await this.invalidateCache();
    return saved;
  }

  async delete(id: string) {
    const post = await this.findOne(id);
    await this.postRepo.remove(post);
    await this.invalidateCache();
    return { success: true };
  }
}
