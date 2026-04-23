import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginatedResponseDto, PaginationDto } from '../common/dto';
import { EventBus } from '../events/event-bus';
import { PlanCreatedEvent } from '../events/domain-events';
import { User } from '../users/entities/user.entity';
import { PlanDto } from './dto/plan.dto';
import { PublicCreatorDto } from './dto/public-creator.dto';
import { SearchCreatorsDto } from './dto/search-creators.dto';

export interface Plan {
  id: number;
  creator: string;
  asset: string;
  amount: string;
  intervalDays: number;
  syncStatus?: 'synced' | 'stale' | 'missing' | 'unknown';
  lastSyncedAt?: Date;
}

@Injectable()
export class CreatorsService {
  private readonly logger = new Logger(CreatorsService.name);
  private plans: Map<number, Plan> = new Map();
  private planCounter = 0;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @Optional()
    private readonly eventBus?: EventBus,
  ) {}

  createPlan(
    creator: string,
    asset: string,
    amount: string,
    intervalDays: number,
  ): Plan {
    const plan = { id: ++this.planCounter, creator, asset, amount, intervalDays };
    this.plans.set(plan.id, plan);
    this.eventBus?.publish(
      new PlanCreatedEvent(plan.id, creator, asset, amount),
    );
    return plan;
  }

  getPlan(id: number): Plan | undefined {
    return this.plans.get(id);
  }

  getCreatorPlans(creator: string): Plan[] {
    return Array.from(this.plans.values()).filter((p) => p.creator === creator);
  }

  findAllPlans(pagination: PaginationDto): PaginatedResponseDto<PlanDto> {
    const { cursor, limit = 20 } = pagination;
    let allPlans = Array.from(this.plans.values()).sort((a, b) => a.id - b.id);

    if (cursor) {
      const cursorId = parseInt(cursor, 10);
      if (!isNaN(cursorId)) {
        allPlans = allPlans.filter((p) => p.id > cursorId);
      }
    }

    const data = allPlans.slice(0, limit + 1);
    const hasMore = data.length > limit;
    if (hasMore) {
      data.pop();
    }

    let nextCursor: string | null = null;
    if (data.length > 0) {
      nextCursor = String(data[data.length - 1].id);
    }

    return new PaginatedResponseDto(
      data.map((plan) => Object.assign(new PlanDto(), plan)),
      limit,
      nextCursor,
      hasMore,
    );
  }

  findCreatorPlans(
    creator: string,
    pagination: PaginationDto,
  ): PaginatedResponseDto<PlanDto> {
    const { cursor, limit = 20 } = pagination;
    let creatorPlans = this.getCreatorPlans(creator).sort((a, b) => a.id - b.id);

    if (cursor) {
      const cursorId = parseInt(cursor, 10);
      if (!isNaN(cursorId)) {
        creatorPlans = creatorPlans.filter((p) => p.id > cursorId);
      }
    }

    const data = creatorPlans.slice(0, limit + 1);
    const hasMore = data.length > limit;
    if (hasMore) {
      data.pop();
    }

    let nextCursor: string | null = null;
    if (data.length > 0) {
      nextCursor = String(data[data.length - 1].id);
    }

    return new PaginatedResponseDto(
      data.map((plan) => Object.assign(new PlanDto(), plan)),
      limit,
      nextCursor,
      hasMore,
    );
  }

  async searchCreators(
    searchDto: SearchCreatorsDto,
  ): Promise<PaginatedResponseDto<PublicCreatorDto>> {
    const { cursor, limit = 20, q } = searchDto;
    const trimmed = q?.trim();

    const qb = this.userRepository
      .createQueryBuilder('user')
      .leftJoin('user.creator', 'creator')
      .addSelect('creator.bio', 'creator_bio')
      .where('user.is_creator = :isCreator', { isCreator: true })
      .orderBy('user.id', 'ASC')
      .take(limit + 1);

    if (cursor) {
      const cursorId = parseInt(cursor, 10);
      if (!isNaN(cursorId)) {
        qb.andWhere('user.id > :cursorId', { cursorId });
      }
    }

    const { entities, raw } = await qb.getRawAndEntities();
    const hasMore = entities.length > limit;
    if (hasMore) {
      entities.pop();
    }

    let nextCursor: string | null = null;
    if (entities.length > 0) {
      nextCursor = String(entities[entities.length - 1].id);
    }

    return new PaginatedResponseDto(entities, limit, nextCursor, hasMore);
  }

    const data = entities.map((user, index) => {
      const dto = new PublicCreatorDto(user, user.creator);
      dto.bio = raw[index]?.creator_bio ?? user.creator?.bio ?? null;
      return dto;
    });

    this.logger.debug(
      `Creator search returned ${data.length} rows for query "${trimmed ?? ''}"`,
    );

    return new PaginatedResponseDto(data, total, page, limit);
  }
}
