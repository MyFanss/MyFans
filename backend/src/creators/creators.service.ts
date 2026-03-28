import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PaginationDto, PaginatedResponseDto } from '../common/dto';
import { SearchCreatorsDto } from './dto/search-creators.dto';
import { PublicCreatorDto } from './dto/public-creator.dto';
import { User } from '../users/entities/user.entity';
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
    private readonly chainReader: SubscriptionChainReaderService,
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

  @Cron(CronExpression.EVERY_HOUR)
  async handlePlanReconciliation() {
    this.logger.log('Starting plan metadata reconciliation with chain');
    try {
      await this.reconcilePlansWithChain();
      this.logger.log('Plan metadata reconciliation completed successfully');
    } catch (error) {
      this.logger.error('Plan metadata reconciliation failed', error);
    }
  }
    const contractId = this.chainReader.getConfiguredContractId();
    if (!contractId) {
      console.warn('No contract ID configured, skipping plan reconciliation');
      return;
    }

    // Get plan count from chain
    const countResult = await this.chainReader.readPlanCount(contractId);
    if (!countResult.ok) {
      console.error('Failed to read plan count from chain:', countResult.error);
      return;
    }

    const chainPlanCount = countResult.count;

    // Read all chain plans
    const chainPlans: Map<number, Plan> = new Map();
    for (let id = 1; id <= chainPlanCount; id++) {
      const planResult = await this.chainReader.readPlan(contractId, id);
      if (planResult.ok) {
        chainPlans.set(id, {
          id,
          creator: planResult.plan.creator,
          asset: planResult.plan.asset,
          amount: planResult.plan.amount,
          intervalDays: planResult.plan.intervalDays,
          syncStatus: 'synced',
          lastSyncedAt: new Date(),
        });
      } else {
        console.error(`Failed to read plan ${id} from chain:`, planResult.error);
      }
    }

    // Compare with backend plans
    for (const [id, backendPlan] of this.plans) {
      const chainPlan = chainPlans.get(id);
      if (!chainPlan) {
        // Plan exists in backend but not on chain - mark as stale
        backendPlan.syncStatus = 'stale';
        backendPlan.lastSyncedAt = new Date();
      } else {
        // Check if data matches
        const matches =
          backendPlan.creator === chainPlan.creator &&
          backendPlan.asset === chainPlan.asset &&
          backendPlan.amount === chainPlan.amount &&
          backendPlan.intervalDays === chainPlan.intervalDays;
        backendPlan.syncStatus = matches ? 'synced' : 'stale';
        backendPlan.lastSyncedAt = new Date();
        // Remove from chainPlans as it's matched
        chainPlans.delete(id);
      }
    }

    // Remaining chainPlans are missing from backend - add them
    for (const [id, chainPlan] of chainPlans) {
      this.plans.set(id, { ...chainPlan, syncStatus: 'missing' });
    }
  }
