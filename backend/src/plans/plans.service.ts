import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

const CLASSIC_ASSET_PATTERN = /^[A-Z0-9]{2,12}$/;
const CONTRACT_ASSET_PATTERN = /^C[A-Z0-9]{55}$/;

function isValidAsset(asset: string): boolean {
  if (typeof asset !== 'string') {
    return false;
  }
  if (asset.length === 0 || /\s/.test(asset)) {
    return false;
  }
  return CLASSIC_ASSET_PATTERN.test(asset) || CONTRACT_ASSET_PATTERN.test(asset);
}

function normalizeAsset(asset: string): string {
  // Contract addresses are stored unchanged; classic codes are uppercased.
  if (CONTRACT_ASSET_PATTERN.test(asset)) {
    return asset;
  }
  return asset.toUpperCase();
}

export interface PlanMetadata {
  planId: string;
  creator: string;
  asset: string;
  amount: string;
  interval: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlanInput {
  planId: string;
  creator: string;
  asset: string;
  amount: string;
  interval: string;
}

export interface UpdatePlanInput {
  creator: string;
  asset?: string;
  amount?: string;
  interval?: string;
}

@Injectable()
export class PlansService {
  private readonly plans = new Map<string, PlanMetadata>();

  create(input: CreatePlanInput): PlanMetadata {
    const planId = input.planId.trim();
    const creator = input.creator.trim();

    if (this.plans.has(planId)) {
      throw new ConflictException(`Plan ${planId} already exists`);
    }

    const asset = this.validateAsset(input.asset);
    const amount = this.validateAmount(input.amount);
    const interval = this.validateInterval(input.interval);

    const now = new Date().toISOString();
    const plan: PlanMetadata = {
      planId,
      creator,
      asset,
      amount,
      interval,
      createdAt: now,
      updatedAt: now,
    };

    this.plans.set(planId, plan);
    return plan;
  }

  update(planId: string, input: UpdatePlanInput): PlanMetadata {
    const existing = this.plans.get(planId);
    if (!existing) {
      throw new NotFoundException(`Plan ${planId} not found`);
    }
    if (existing.creator !== input.creator) {
      throw new ForbiddenException('Only the plan creator may update this plan');
    }

    const updated: PlanMetadata = {
      ...existing,
      asset: input.asset !== undefined ? this.validateAsset(input.asset) : existing.asset,
      amount: input.amount !== undefined ? this.validateAmount(input.amount) : existing.amount,
      interval:
        input.interval !== undefined ? this.validateInterval(input.interval) : existing.interval,
      updatedAt: new Date().toISOString(),
    };

    this.plans.set(planId, updated);
    return updated;
  }

  remove(planId: string, creator: string): void {
    const existing = this.plans.get(planId);
    if (!existing) {
      throw new NotFoundException(`Plan ${planId} not found`);
    }
    if (existing.creator !== creator) {
      throw new ForbiddenException('Only the plan creator may remove this plan');
    }
    this.plans.delete(planId);
  }

  findOne(planId: string): PlanMetadata {
    const plan = this.plans.get(planId);
    if (!plan) {
      throw new NotFoundException(`Plan ${planId} not found`);
    }
    return plan;
  }

  listByCreator(creator: string): PlanMetadata[] {
    return Array.from(this.plans.values())
      .filter((plan) => plan.creator === creator)
      .sort((a, b) => a.planId.localeCompare(b.planId));
  }

  private validateAsset(asset: string): string {
    if (!isValidAsset(asset)) {
      throw new BadRequestException(
        'asset must be a classic asset code (2-12 uppercase alphanumerics) or a 56-character contract address starting with C',
      );
    }
    return normalizeAsset(asset);
  }

  private validateAmount(amount: string): string {
    if (!/^\d+(\.\d+)?$/.test(amount) || Number(amount) <= 0) {
      throw new BadRequestException('amount must be a positive decimal number');
    }
    return amount;
  }

  private validateInterval(interval: string): string {
    const match = /^(\d+)d$/.exec(interval);
    if (!match || Number(match[1]) <= 0) {
      throw new BadRequestException('interval must be a positive number of days, e.g. 30d');
    }
    return interval;
  }
}
