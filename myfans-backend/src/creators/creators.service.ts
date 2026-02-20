import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Creator } from './entities/creator.entity';
import { FindCreatorsQueryDto } from './dto/find-creators-query.dto';

const BIO_SNIPPET_LENGTH = 150;

@Injectable()
export class CreatorsService {
  constructor(
    @InjectRepository(Creator)
    private readonly creatorRepo: Repository<Creator>,
  ) {}

  async findAll(query: FindCreatorsQueryDto) {
    const { page = 1, limit = 20, is_verified, min_price, max_price } = query;
    const skip = (page - 1) * limit;

    const qb = this.creatorRepo
      .createQueryBuilder('creator')
      .leftJoinAndSelect('creator.user', 'user')
      .where('user.is_creator = :is_creator', { is_creator: true })
      .orderBy('creator.created_at', 'DESC');

    if (is_verified !== undefined) {
      qb.andWhere('creator.is_verified = :is_verified', { is_verified });
    }
    if (min_price !== undefined) {
      qb.andWhere('creator.subscription_price >= :min_price', {
        min_price: String(min_price),
      });
    }
    if (max_price !== undefined) {
      qb.andWhere('creator.subscription_price <= :max_price', {
        max_price: String(max_price),
      });
    }

    const [creators, total] = await qb.skip(skip).take(limit).getManyAndCount();

    const items = creators.map((c) => this.toListItem(c));

    return {
      items,
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
    };
  }

  async findOneById(id: string) {
    const creator = await this.creatorRepo.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!creator) {
      throw new NotFoundException(`Creator with id ${id} not found`);
    }
    return this.toDetailItem(creator);
  }

  async findOneByUsername(username: string) {
    const creator = await this.creatorRepo
      .createQueryBuilder('creator')
      .leftJoinAndSelect('creator.user', 'user')
      .where('user.username = :username', { username })
      .andWhere('user.is_creator = :is_creator', { is_creator: true })
      .getOne();

    if (!creator) {
      throw new NotFoundException(`Creator with username ${username} not found`);
    }
    return this.toDetailItem(creator);
  }

  private toListItem(creator: Creator) {
    const bio = creator.bio ?? '';
    const bio_snippet =
      bio.length > BIO_SNIPPET_LENGTH
        ? bio.slice(0, BIO_SNIPPET_LENGTH) + '...'
        : bio || null;

    return {
      id: creator.id,
      username: creator.user?.username ?? null,
      display_name: creator.user?.display_name ?? null,
      avatar_url: creator.user?.avatar_url ?? null,
      bio_snippet,
      subscription_price: creator.subscription_price,
      currency: creator.currency,
      is_verified: creator.is_verified,
      post_count: 0,
      subscriber_count: 0,
    };
  }

  private toDetailItem(creator: Creator) {
    return {
      id: creator.id,
      username: creator.user?.username ?? null,
      display_name: creator.user?.display_name ?? null,
      avatar_url: creator.user?.avatar_url ?? null,
      bio: creator.bio ?? null,
      subscription_price: creator.subscription_price,
      currency: creator.currency,
      is_verified: creator.is_verified,
      post_count: 0,
      subscriber_count: 0,
      created_at: creator.created_at,
      updated_at: creator.updated_at,
    };
  }
}
