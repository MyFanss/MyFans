import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

/**
 * Plan metadata linked to an on-chain plan_id.
 *
 * Metadata is keyed by the on-chain plan_id so the dashboard can render a
 * plan without trusting the chain alone, while the chain remains the source
 * of truth for the plan's existence. Only the plan's creator may mutate the
 * metadata; listing by creator is public.
 */
export interface PlanMetadata {
  planId: string;
  creator: string;
  asset: string;
  amount: string;
  interval: string;
  title?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

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
  private readonly plans = new Map<string, PlanMetadata>();

  /**
   * Create metadata for an on-chain plan_id. Fails if metadata already exists
   * for that plan_id (plan_id collision / duplicate registration).
   */
  create(input: UpsertPlanMetadataInput): PlanMetadata {
    const planId = this.normalizePlanId(input.planId);
    if (this.plans.has(planId)) {
      throw new ConflictException(`Plan metadata already exists for plan_id ${planId}`);
    }

    const now = new Date().toISOString();
    const plan: PlanMetadata = {
      planId,
      creator: this.normalizeCreator(input.creator),
      asset: this.validateAsset(input.asset),
      amount: this.validateAmount(input.amount),
      interval: this.validateInterval(input.interval),
      title: input.title,
      description: input.description,
      createdAt: now,
      updatedAt: now,
    };

    this.plans.set(planId, plan);
    return plan;
  }

  /**
   * Update metadata for an existing plan_id. Only the creator that owns the
   * plan may mutate it.
   */
  update(planId: string, requester: string, input: Partial<UpsertPlanMetadataInput>): PlanMetadata {
    const existing = this.getOwned(planId, requester);

    const updated: PlanMetadata = {
      ...existing,
      asset: input.asset !== undefined ? this.validateAsset(input.asset) : existing.asset,
      amount: input.amount !== undefined ? this.validateAmount(input.amount) : existing.amount,
      interval: input.interval !== undefined ? this.validateInterval(input.interval) : existing.interval,
      title: input.title !== undefined ? input.title : existing.title,
      description: input.description !== undefined ? input.description : existing.description,
      updatedAt: new Date().toISOString(),
    };

    this.plans.set(existing.planId, updated);
    return updated;
  }

  /**
   * Delete metadata for a plan_id. Only the creator that owns the plan may
   * mutate it.
   */
  remove(planId: string, requester: string): PlanMetadata {
    const existing = this.getOwned(planId, requester);
    this.plans.delete(existing.planId);
    return existing;
  }

  /**
   * Read metadata for a plan_id. Public.
   */
  findOne(planId: string): PlanMetadata {
    const normalized = this.normalizePlanId(planId);
    const plan = this.plans.get(normalized);
    if (!plan) {
      throw new NotFoundException(`No plan metadata for plan_id ${normalized}`);
    }
    return plan;
  }

  /**
   * List metadata for a creator. Public.
   */
  listByCreator(creator: string): PlanMetadata[] {
    const normalized = this.normalizeCreator(creator);
    return Array.from(this.plans.values())
      .filter((plan) => plan.creator === normalized)
      .sort((a, b) => a.planId.localeCompare(b.planId));
  }

  private getOwned(planId: string, requester: string): PlanMetadata {
    const existing = this.findOne(planId);
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
