import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationDto, PaginatedResponseDto } from '../common/dto';
import { SearchCreatorsDto } from './dto/search-creators.dto';
import { PublicCreatorDto } from './dto/public-creator.dto';
import { User } from '../users/entities/user.entity';
import {
  CreatorPayoutHistoryResult,
  SubscriptionsService,
} from '../subscriptions/subscriptions.service';
import { CreatorPayoutHistoryQueryDto } from './dto';

export interface Plan {
  id: number;
  creator: string;
  asset: string;
  amount: string;
  intervalDays: number;
}

@Injectable()
export class CreatorsService {
  private plans: Map<number, Plan> = new Map();
  private planCounter = 0;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  createPlan(creator: string, asset: string, amount: string, intervalDays: number): Plan {
    const plan = { id: ++this.planCounter, creator, asset, amount, intervalDays };
    this.plans.set(plan.id, plan);
    return plan;
  }

  getPlan(id: number): Plan | undefined {
    return this.plans.get(id);
  }

  getCreatorPlans(creator: string): Plan[] {
    return Array.from(this.plans.values()).filter(p => p.creator === creator);
  }

  findAllPlans(pagination: PaginationDto): PaginatedResponseDto<Plan> {
    const { page = 1, limit = 20 } = pagination;
    const allPlans = Array.from(this.plans.values());
    const total = allPlans.length;
    const data = allPlans.slice((page - 1) * limit, page * limit);
    return new PaginatedResponseDto(data, total, page, limit);
  }

  findCreatorPlans(creator: string, pagination: PaginationDto): PaginatedResponseDto<Plan> {
    const { page = 1, limit = 20 } = pagination;
    const creatorPlans = this.getCreatorPlans(creator);
    const total = creatorPlans.length;
    const data = creatorPlans.slice((page - 1) * limit, page * limit);
    return new PaginatedResponseDto(data, total, page, limit);
  }

  async searchCreators(searchDto: SearchCreatorsDto): Promise<PaginatedResponseDto<PublicCreatorDto>> {
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
    const { entities, raw } = await qb.skip((page - 1) * limit).take(limit).getRawAndEntities();

    const data = entities.map((user, i) => {
      const dto = new PublicCreatorDto(user);
      dto.bio = raw[i]?.creator_bio ?? null;
      return dto;
    });

    return new PaginatedResponseDto(data, total, page, limit);
  }

  getPayoutHistory(
    creatorAddress: string,
    query: CreatorPayoutHistoryQueryDto,
  ): CreatorPayoutHistoryResult {
    return this.subscriptionsService.getCreatorPayoutHistory({
      creatorAddress,
      from: query.from,
      to: query.to,
      cursor: query.cursor,
      limit: query.limit,
    });
  }
}
