import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

const CLASSIC_ASSET_PATTERN = /^[A-Z0-9]{2,12}$/;
const CONTRACT_ASSET_PATTERN = /^C[A-Z0-9]{55}$/;

// Soroban produces one ledger roughly every five seconds, so a day is 24 hours
// of seconds divided by five. This mirrors PERIOD_LEDGERS in the subscription
// contract and is the factor used to convert a day label like "30d" into the
// ledger count the contract actually stores and compares.
const LEDGERS_PER_DAY = 17_280;

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

// Derive a display label from a stored ledger count. Day-aligned intervals keep
// the compact "Nd" form; anything else is marked explicitly as a ledger count
// so a mismatch with the on-chain plan can never masquerade as "a month".
function intervalLabelFor(interval: string): string {
  const ledgers = Number(interval);
  if (ledgers % LEDGERS_PER_DAY === 0) {
    return `${ledgers / LEDGERS_PER_DAY}d`;
  }
  return `${ledgers} ledgers`;
}

export interface PlanMetadata {
  planId: string;
  creator: string;
  asset: string;
  amount: string;
  /** Billing interval as a raw ledger count, comparable to the contract's u64. */
  interval: string;
  /** Display label derived from `interval`, e.g. "30d" or "100 ledgers". */
  intervalLabel: string;
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
    const intervalLabel = intervalLabelFor(interval);

    const now = new Date().toISOString();
    const plan: PlanMetadata = {
      planId,
      creator,
      asset,
      amount,
      interval,
      intervalLabel,
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

    const interval =
      input.interval !== undefined ? this.validateInterval(input.interval) : existing.interval;

    const updated: PlanMetadata = {
      ...existing,
      asset: input.asset !== undefined ? this.validateAsset(input.asset) : existing.asset,
      amount: input.amount !== undefined ? this.validateAmount(input.amount) : existing.amount,
      interval,
      intervalLabel: intervalLabelFor(interval),
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
    if (!/^\d+(\.\d+)?$/.test(amount)) {
      throw new BadRequestException('amount must be a positive decimal number');
    }
    return amount;
  }

  private validateInterval(interval: string): string {
    const value = String(interval).trim();

    // Raw ledger count: the exact value the contract stores and compares.
    if (/^\d+$/.test(value)) {
      const ledgers = Number(value);
      if (ledgers <= 0) {
        throw new BadRequestException('interval must be a positive ledger count');
      }
      return String(ledgers);
    }

    // Day label ("30d"): converted to ledgers with the five-second assumption.
    const match = /^(\d+)d$/.exec(value);
    if (match && Number(match[1]) > 0) {
      return String(Number(match[1]) * LEDGERS_PER_DAY);
    }

    throw new BadRequestException(
      'interval must be a positive ledger count or a day label such as 30d',
    );
  }
}
