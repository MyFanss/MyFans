import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PlanMetadata } from './entities/plan-metadata.entity';

export { PlanMetadata };

export interface UpsertPlanMetadataInput {
  planId: string;
  creator: string;
  asset: string;
  amount: string;
  interval: string;
  title?: string;
  description?: string;
}

const ASSET_PATTERN = /^[A-Z0-9]{2,12}$/;
const AMOUNT_PATTERN = /^\d+(\.\d+)?$/;
const INTERVAL_PATTERN = /^[1-9]\d*(s|m|h|d|w|mo|y)$/;

@Injectable()
export class PlansService {
  constructor(
    @InjectRepository(PlanMetadata)
    private readonly plans: Repository<PlanMetadata>,
  ) {}

  /**
   * Create metadata for an on-chain plan_id. Fails if metadata already exists
   * for that plan_id (plan_id collision / duplicate registration).
   */
  async create(input: UpsertPlanMetadataInput): Promise<PlanMetadata> {
    const planId = this.normalizePlanId(input.planId);
    const existing = await this.plans.findOne({ where: { planId } });
    if (existing) {
      throw new ConflictException(`Plan metadata already exists for plan_id ${planId}`);
    }

    const now = new Date().toISOString();
    const plan = this.plans.create({
      planId,
      creator: this.normalizeCreator(input.creator),
      asset: this.validateAsset(input.asset),
      amount: this.validateAmount(input.amount),
      interval: this.validateInterval(input.interval),
      title: input.title,
      description: input.description,
      createdAt: now,
      updatedAt: now,
    });

    return this.plans.save(plan);
  }

  /**
   * Update metadata for an existing plan_id. Only the creator that owns the
   * plan may mutate it.
   */
  async update(
    planId: string,
    requester: string,
    input: Partial<UpsertPlanMetadataInput>,
  ): Promise<PlanMetadata> {
    const existing = await this.getOwned(planId, requester);

    const updated: PlanMetadata = {
      ...existing,
      asset: input.asset !== undefined ? this.validateAsset(input.asset) : existing.asset,
      amount: input.amount !== undefined ? this.validateAmount(input.amount) : existing.amount,
      interval: input.interval !== undefined ? this.validateInterval(input.interval) : existing.interval,
      title: input.title !== undefined ? input.title : existing.title,
      description: input.description !== undefined ? input.description : existing.description,
      updatedAt: new Date().toISOString(),
    };

    return this.plans.save(updated);
  }

  /**
   * Delete metadata for a plan_id. Only the creator that owns the plan may
   * mutate it.
   */
  async remove(planId: string, requester: string): Promise<PlanMetadata> {
    const existing = await this.getOwned(planId, requester);
    await this.plans.delete({ planId: existing.planId });
    return existing;
  }

  /**
   * Read metadata for a plan_id. Public.
   */
  async findOne(planId: string): Promise<PlanMetadata> {
    const normalized = this.normalizePlanId(planId);
    const plan = await this.plans.findOne({ where: { planId: normalized } });
    if (!plan) {
      throw new NotFoundException(`No plan metadata for plan_id ${normalized}`);
    }
    return plan;
  }

  /**
   * List metadata for a creator. Public.
   */
  async listByCreator(creator: string): Promise<PlanMetadata[]> {
    const normalized = this.normalizeCreator(creator);
    return this.plans.find({
      where: { creator: normalized },
      order: { planId: 'ASC' },
    });
  }

  private async getOwned(planId: string, requester: string): Promise<PlanMetadata> {
    const existing = await this.findOne(planId);
    const normalizedRequester = this.normalizeCreator(requester);
    if (existing.creator !== normalizedRequester) {
      throw new ForbiddenException('Only the plan creator may mutate plan metadata');
    }
    return existing;
  }

  private normalizePlanId(planId: string): string {
    if (typeof planId !== 'string' || planId.trim().length === 0) {
      throw new BadRequestException('plan_id is required');
    }
    return planId.trim();
  }

  private normalizeCreator(creator: string): string {
    if (typeof creator !== 'string' || creator.trim().length === 0) {
      throw new BadRequestException('creator is required');
    }
    return creator.trim();
  }

  private validateAsset(asset: string): string {
    if (typeof asset !== 'string' || !ASSET_PATTERN.test(asset)) {
      throw new BadRequestException('asset must be an uppercase asset code (2-12 chars)');
    }
    return asset;
  }

  private validateAmount(amount: string): string {
    if (typeof amount !== 'string' || !AMOUNT_PATTERN.test(amount)) {
      throw new BadRequestException('amount must be a positive decimal string');
    }
    if (Number(amount) <= 0) {
      throw new BadRequestException('amount must be greater than zero');
    }
    return amount;
  }

  private validateInterval(interval: string): string {
    if (typeof interval !== 'string' || !INTERVAL_PATTERN.test(interval)) {
      throw new BadRequestException('interval must be a duration like 30d, 1w, or 1mo');
    }
    return interval;
  }
}
