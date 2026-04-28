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
import { SubscriptionChainReaderService } from '../subscriptions/subscription-chain-reader.service';

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
    @Optional()
    private readonly chainReader?: SubscriptionChainReaderService,
  ) {}

  createPlan(
    creator: string,
    asset: string,
    amount: string,
    intervalDays: number,
  ): Plan {
    const plan = { id: ++this.planCounter, creator, asset, amount, intervalDays };
    this.plans.set(plan.id, plan);
    if (!this.eventBus) {
      this.logger.debug(
        `Plan ${plan.id} created for ${creator}; EventBus not wired, skipping PlanCreatedEvent`,
      );
    } else {
      try {
        this.eventBus.publish(
          new PlanCreatedEvent(plan.id, creator, asset, amount),
        );
      } catch (err) {
        this.logger.warn(
          `Plan ${plan.id} created but PlanCreatedEvent publish failed: ${(err as Error).message}`,
        );
      }
    }
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
      } else {
        this.logger.debug(`Ignoring invalid plans pagination cursor "${cursor}"`);
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
      } else {
        this.logger.debug(
          `Ignoring invalid creator plans pagination cursor "${cursor}" for ${creator}`,
        );
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

  /**
   * Lists all in-memory plans, optionally merging chain state for each plan.
   * Chain reads are best-effort: stale/disconnected results fall back to
   * syncStatus='unknown' so callers always receive a valid response.
   */
  async listCreators(mergeChain = false): Promise<PlanDto[]> {
    const allPlans = Array.from(this.plans.values()).sort((a, b) => a.id - b.id);

    if (!mergeChain) {
      return allPlans.map((p) => Object.assign(new PlanDto(), p));
    }

    const contractId = this.chainReader?.getConfiguredContractId();
    if (!contractId || !this.chainReader) {
      this.logger.debug('listCreators: chain reader not configured, skipping merge');
      return allPlans.map((p) =>
        Object.assign(new PlanDto(), { ...p, syncStatus: 'unknown' }),
      );
    }

    // Build planMap for O(1) lookup during merge
    const planMap = new Map(allPlans.map((p) => [p.id, p]));

    const merged = await Promise.all(
      allPlans.map(async (plan) => {
        const chainResult = await this.chainReader!.readPlan(contractId, plan.id);
        if (!chainResult.ok) {
          this.logger.warn(
            `listCreators: chain read failed for plan ${plan.id}: ${chainResult.error}`,
          );
          const local = planMap.get(plan.id)!;
          return Object.assign(new PlanDto(), {
            ...local,
            syncStatus: 'unknown' as const,
          });
        }

        const local = planMap.get(plan.id)!;
        const chainPlan = chainResult.plan;
        const isSynced =
          local.creator === chainPlan.creator &&
          local.asset === chainPlan.asset &&
          local.amount === chainPlan.amount &&
          local.intervalDays === chainPlan.intervalDays;

        return Object.assign(new PlanDto(), {
          ...local,
          syncStatus: isSynced ? ('synced' as const) : ('stale' as const),
          lastSyncedAt: new Date(),
        });
      }),
    );

    return merged;
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
      .orderBy('user.username', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    if (trimmed) {
      qb.andWhere(
        '(LOWER(user.display_name) LIKE :search OR LOWER(user.username) LIKE :search)',
        { search: `${trimmed.toLowerCase()}%` },
      );
    }

    let entities: User[];
    let raw: { creator_bio?: string }[];
    let total: number;
    try {
      const [{ entities: e, raw: r }, t] = await Promise.all([
        qb.getRawAndEntities(),
        qb.getCount(),
      ]);
      entities = e;
      raw = r as { creator_bio?: string }[];
      total = t;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Creator search failed: ${message}`);
      throw err;
    }

    const data = entities.map((user, index) => {
      const dto = new PublicCreatorDto(user, user.creator);
      dto.bio = raw[index]?.creator_bio ?? user.creator?.bio ?? null;
      return dto;
    });

    this.logger.debug(
      `Creator search returned ${data.length}/${total} rows for query "${trimmed ?? ''}"`,
    );

    return new PaginatedResponseDto(data, total, page, limit);
  }
}
