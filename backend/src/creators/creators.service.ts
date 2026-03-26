import { Injectable } from '@nestjs/common';
import { EventBus } from '../events/event-bus';
import { PlanCreatedEvent } from '../events/domain-events';
import { PaginationDto, PaginatedResponseDto } from '../common/dto';
import { PlanDto, SearchCreatorsDto, PublicCreatorDto } from './dto';
import { Creator } from './entities/creator.entity';

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

  constructor(private readonly eventBus: EventBus) {}

  createPlan(creator: string, asset: string, amount: string, intervalDays: number): Plan {
    const plan = { id: ++this.planCounter, creator, asset, amount, intervalDays };
    this.plans.set(plan.id, plan);

    this.eventBus.publish(
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

  /**
   * Get all plans with pagination
   */
  findAllPlans(pagination: PaginationDto): PaginatedResponseDto<PlanDto> {
    const { page = 1, limit = 20 } = pagination;
    const allPlans = Array.from(this.plans.values());
    const total = allPlans.length;
    const skip = (page - 1) * limit;
    const data = allPlans.slice(skip, skip + limit);

    return new PaginatedResponseDto(data, total, page, limit);
  }

  /**
   * Get creator plans with pagination
   */
  findCreatorPlans(
    creator: string,
    pagination: PaginationDto,
  ): PaginatedResponseDto<PlanDto> {
    const { page = 1, limit = 20 } = pagination;
    const creatorPlans = this.getCreatorPlans(creator);
    const total = creatorPlans.length;
    const skip = (page - 1) * limit;
    const data = creatorPlans.slice(skip, skip + limit);

    return new PaginatedResponseDto(data, total, page, limit);
  }

  /**
   * Search creators by display name or username with pagination.
   * Note: this is an in-memory implementation; replace with a DB query when
   * a UsersRepository is injected into this service.
   */
  async searchCreators(
    searchDto: SearchCreatorsDto,
  ): Promise<PaginatedResponseDto<PublicCreatorDto>> {
    const { q, page = 1, limit = 20 } = searchDto;

    let creators = Array.from(this.plans.values()).map((p) => p.creator);
    // Deduplicate
    creators = [...new Set(creators)];

    if (q && q.trim()) {
      const term = q.trim().toLowerCase();
      creators = creators.filter((c) => c.toLowerCase().includes(term));
    }

    const total = creators.length;
    const skip = (page - 1) * limit;
    const data = creators.slice(skip, skip + limit).map(
      (address) => new PublicCreatorDto({ id: address } as any, undefined),
    );

    return new PaginatedResponseDto(data, total, page, limit);
  }
}
