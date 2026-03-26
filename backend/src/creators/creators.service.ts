import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationDto, PaginatedResponseDto } from '../common/dto';
import { PlanDto } from './dto/plan.dto';
import { SearchCreatorsDto } from './dto/search-creators.dto';
import { PublicCreatorDto } from './dto/public-creator.dto';
import { User } from '../users/entities/user.entity';
import { Creator } from './entities/creator.entity';
import { EventBus } from '../events/event-bus';
import { PlanCreatedEvent } from '../events/domain-events';

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
    private readonly usersRepository: Repository<User>,
    private readonly eventBus: EventBus,
  ) {}

  createPlan(creator: string, asset: string, amount: string, intervalDays: number): Plan {
    const plan = { id: ++this.planCounter, creator, asset, amount, intervalDays };
    this.plans.set(plan.id, plan);
    this.eventBus.publish(new PlanCreatedEvent(plan.id, creator, asset, amount));
    return plan;
  }

  getPlan(id: number): Plan | undefined {
    return this.plans.get(id);
  }

  getCreatorPlans(creator: string): Plan[] {
    return Array.from(this.plans.values()).filter(p => p.creator === creator);
  }

  findAllPlans(pagination: PaginationDto): PaginatedResponseDto<PlanDto> {
    const { page = 1, limit = 20 } = pagination;
    const allPlans = Array.from(this.plans.values());
    const skip = (page - 1) * limit;
    return new PaginatedResponseDto(allPlans.slice(skip, skip + limit), allPlans.length, page, limit);
  }

  findCreatorPlans(creator: string, pagination: PaginationDto): PaginatedResponseDto<PlanDto> {
    const { page = 1, limit = 20 } = pagination;
    const creatorPlans = this.getCreatorPlans(creator);
    const skip = (page - 1) * limit;
    return new PaginatedResponseDto(creatorPlans.slice(skip, skip + limit), creatorPlans.length, page, limit);
  }

  async searchCreators(searchDto: SearchCreatorsDto): Promise<PaginatedResponseDto<PublicCreatorDto>> {
    const { q, page = 1, limit = 20 } = searchDto;

    const queryBuilder = this.usersRepository
      .createQueryBuilder('user')
      .leftJoin(Creator, 'creator', 'creator.userId = user.id')
      .addSelect('creator.bio')
      .where('user.is_creator = :isCreator', { isCreator: true });

    if (q?.trim()) {
      const search = q.trim().toLowerCase();
      queryBuilder.andWhere(
        '(LOWER(user.display_name) LIKE :search OR LOWER(user.username) LIKE :search)',
        { search: `${search}%` },
      );
    }

    queryBuilder.orderBy('user.username', 'ASC');
    const total = await queryBuilder.getCount();
    const results = await queryBuilder.skip((page - 1) * limit).take(limit).getRawAndEntities();

    const data = results.entities.map((user, i) => {
      const raw = results.raw[i] as { creator_bio?: string };
      const creator = raw?.creator_bio ? ({ bio: raw.creator_bio } as Creator) : undefined;
      return new PublicCreatorDto(user, creator);
    });

    return new PaginatedResponseDto(data, total, page, limit);
  }
}
