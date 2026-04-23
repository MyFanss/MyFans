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
    const { page = 1, limit = 20 } = pagination;
    const allPlans = Array.from(this.plans.values());
    const total = allPlans.length;
    const data = allPlans
      .slice((page - 1) * limit, page * limit)
      .map((plan) => Object.assign(new PlanDto(), plan));
    return new PaginatedResponseDto(data, total, page, limit);
  }

  findCreatorPlans(
    creator: string,
    pagination: PaginationDto,
  ): PaginatedResponseDto<PlanDto> {
    const { page = 1, limit = 20 } = pagination;
    const creatorPlans = this.getCreatorPlans(creator);
    const total = creatorPlans.length;
    const data = creatorPlans
      .slice((page - 1) * limit, page * limit)
      .map((plan) => Object.assign(new PlanDto(), plan));
    return new PaginatedResponseDto(data, total, page, limit);
  }

  async searchCreators(
    searchDto: SearchCreatorsDto,
  ): Promise<PaginatedResponseDto<PublicCreatorDto>> {
    const { page = 1, limit = 20, q } = searchDto;
    const trimmed = q?.trim();

    const qb = this.userRepository
      .createQueryBuilder('user')
      .leftJoin('user.creator', 'creator')
      .addSelect('creator.bio', 'creator_bio')
      .where('user.is_creator = :isCreator', { isCreator: true })
      .orderBy('user.username', 'ASC');

    if (trimmed) {
      qb.andWhere(
        '(LOWER(user.display_name) LIKE :search OR LOWER(user.username) LIKE :search)',
        { search: `${trimmed.toLowerCase()}%` },
      );
    }

    const total = await qb.getCount();
    const { entities, raw } = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getRawAndEntities();

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
