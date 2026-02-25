import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationDto, PaginatedResponseDto } from '../common/dto';
import { PlanDto } from './dto/plan.dto';
import { SearchCreatorsDto } from './dto/search-creators.dto';
import { PublicCreatorDto } from './dto/public-creator.dto';
import { User } from '../users/entities/user.entity';
import { Creator } from '../users/entities/creator.entity';

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
  findCreatorPlans(creator: string, pagination: PaginationDto): PaginatedResponseDto<PlanDto> {
    const { page = 1, limit = 20 } = pagination;
    const creatorPlans = this.getCreatorPlans(creator);
    const total = creatorPlans.length;
    const skip = (page - 1) * limit;
    const data = creatorPlans.slice(skip, skip + limit);

    return new PaginatedResponseDto(data, total, page, limit);
  }

  /**
   * Search creators by display name or username with pagination
   */
  async searchCreators(
    searchDto: SearchCreatorsDto
  ): Promise<PaginatedResponseDto<PublicCreatorDto>> {
    const { q, page = 1, limit = 20 } = searchDto;

    // Build query with LEFT JOIN to Creator entity
    const queryBuilder = this.usersRepository
      .createQueryBuilder('user')
      .leftJoin(Creator, 'creator', 'creator.userId = user.id')
      .addSelect('creator.bio')
      .where('user.is_creator = :isCreator', { isCreator: true });

    // Apply search filter if query provided
    if (q && q.trim()) {
      const searchTerm = q.trim().toLowerCase();
      queryBuilder.andWhere(
        '(LOWER(user.display_name) LIKE :search OR LOWER(user.username) LIKE :search)',
        { search: `${searchTerm}%` }
      );
    }

    // Apply ordering
    queryBuilder.orderBy('user.username', 'ASC');

    // Get total count
    const total = await queryBuilder.getCount();

    // Apply pagination
    const skip = (page - 1) * limit;
    const results = await queryBuilder
      .skip(skip)
      .take(limit)
      .getRawAndEntities();

    // Map to DTOs
    const data = results.entities.map((user, index) => {
      const rawResult = results.raw[index];
      const creator = rawResult.creator_bio ? { bio: rawResult.creator_bio } as Creator : undefined;
      return new PublicCreatorDto(user, creator);
    });

    return new PaginatedResponseDto(data, total, page, limit);
  }
}
