import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';

export interface ListCreatorsParams {
  limit: number;
  cursor: string | null;
  query: string | null;
}

export interface CreatorListItem {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  subscriberCount: number;
  isVerified: boolean;
}

export interface CreatorPlanItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  interval: string;
  isActive: boolean;
}

export interface CreatorAccess {
  hasAccess: boolean;
  subscriptionStatus: string;
  planId: string | null;
  teaser: string | null;
  contentCid: string | null;
}

export interface DashboardSummary {
  subscribers: number;
  activeSubscriptions: number;
  monthlyRevenue: number;
  currency: string;
}

@Injectable()
export class CreatorsService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async listCreators(params: ListCreatorsParams): Promise<CreatorListItem[]> {
    const { limit, cursor, query } = params;

    const qb = this.usersRepository
      .createQueryBuilder('user')
      .where('user.isCreator = :isCreator', { isCreator: true })
      .orderBy('user.id', 'ASC')
      .take(limit);

    // Stable cursor pagination: resume strictly after the last seen id.
    if (cursor) {
      qb.andWhere('user.id > :cursor', { cursor });
    }

    // The controller already trims and drops queries shorter than two chars;
    // guard here too so a null query never filters the result set.
    const trimmed = query?.trim() ?? '';
    if (trimmed.length >= 2) {
      qb.andWhere(
        '(user.handle ILIKE :term OR user.displayName ILIKE :term)',
        { term: `%${trimmed}%` },
      );
    }

    const rows = await qb.getMany();

    return rows.map((row) => ({
      id: row.id,
      handle: row.handle,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl ?? null,
      bio: row.bio ?? null,
      subscriberCount: row.subscriberCount ?? 0,
      isVerified: row.isVerified ?? false,
    }));
  }

  async getCreatorPlans(creatorId: string): Promise<CreatorPlanItem[]> {
    const creator = await this.usersRepository.findOne({ where: { id: creatorId } });
    if (!creator) {
      return [];
    }
    return [];
  }

  async getCreatorAccess(creatorId: string, viewerId: string | null): Promise<CreatorAccess> {
    if (!viewerId) {
      return {
        hasAccess: false,
        subscriptionStatus: 'none',
        planId: null,
        teaser: null,
        contentCid: null,
      };
    }
    return {
      hasAccess: false,
      subscriptionStatus: 'none',
      planId: null,
      teaser: null,
      contentCid: null,
    };
  }

  async getDashboardSummary(creatorId: string): Promise<DashboardSummary> {
    return {
      subscribers: 0,
      activeSubscriptions: 0,
      monthlyRevenue: 0,
      currency: 'USD',
    };
  }
}
