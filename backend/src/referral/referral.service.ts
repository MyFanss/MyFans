import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { ReferralCode } from './entities/referral-code.entity';
import { ReferralRedemption } from './entities/referral-redemption.entity';
import {
  ReferralReward,
  ReferralRewardKind,
} from './entities/referral-reward.entity';
import { CreateReferralCodeDto } from './dto/create-referral-code.dto';
import { RedeemReferralCodeDto } from './dto/redeem-referral-code.dto';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O/0/I/1 ambiguity
const CODE_LENGTH = 8;

/**
 * Reward payout config. Both forms are off-chain bookkeeping only — see
 * `docs/REFERRAL_REWARDS.md`. Overridable via env so ops can tune the
 * program without a deploy.
 */
function resolveRewardKind(): ReferralRewardKind {
  return process.env.REFERRAL_REWARD_KIND === 'FEE_DISCOUNT'
    ? 'FEE_DISCOUNT'
    : 'OFF_CHAIN_CREDIT';
}

function resolveRewardAmount(kind: ReferralRewardKind): string {
  const raw =
    kind === 'FEE_DISCOUNT'
      ? process.env.REFERRAL_REWARD_FEE_DISCOUNT_BPS
      : process.env.REFERRAL_REWARD_CREDIT_AMOUNT;
  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed > 0) return String(parsed);
  return kind === 'FEE_DISCOUNT' ? '1000' : '5'; // 10% fee discount, or 5 credit units
}

function generateCode(): string {
  return Array.from(
    { length: CODE_LENGTH },
    () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)],
  ).join('');
}

@Injectable()
export class ReferralService {
  private readonly logger = new Logger(ReferralService.name);

  constructor(
    @InjectRepository(ReferralCode)
    private readonly codesRepo: Repository<ReferralCode>,
    @InjectRepository(ReferralRedemption)
    private readonly redemptionsRepo: Repository<ReferralRedemption>,
    @InjectRepository(ReferralReward)
    private readonly rewardsRepo: Repository<ReferralReward>,
    private readonly dataSource: DataSource,
  ) {}

  /** Generate a unique referral code for a user. */
  async createCode(
    ownerId: string,
    dto: CreateReferralCodeDto,
  ): Promise<ReferralCode> {
    let code: string;
    let attempts = 0;

    do {
      code = generateCode();
      attempts++;
      if (attempts > 10)
        throw new ConflictException(
          'Could not generate a unique code, try again',
        );
    } while (await this.codesRepo.findOne({ where: { code } }));

    const entity = this.codesRepo.create({
      ownerId,
      code,
      maxUses: dto.maxUses ?? null,
    });

    return this.codesRepo.save(entity);
  }

  /** List all codes owned by a user. */
  async listCodes(ownerId: string): Promise<ReferralCode[]> {
    return this.codesRepo.find({
      where: { ownerId },
      order: { createdAt: 'DESC' },
    });
  }

  /** Deactivate a code (owner only). */
  async deactivateCode(ownerId: string, codeId: string): Promise<ReferralCode> {
    const entity = await this.codesRepo.findOne({ where: { id: codeId } });
    if (!entity) throw new NotFoundException('Referral code not found');
    if (entity.ownerId !== ownerId)
      throw new ForbiddenException('Not your code');

    entity.isActive = false;
    return this.codesRepo.save(entity);
  }

  /** Validate a code without redeeming it (used during checkout preview). */
  async validateCode(
    code: string,
  ): Promise<{ valid: boolean; reason?: string }> {
    const entity = await this.codesRepo.findOne({ where: { code } });
    if (!entity) return { valid: false, reason: 'Code not found' };
    if (!entity.isActive)
      return { valid: false, reason: 'Code is no longer active' };
    if (entity.maxUses !== null && entity.useCount >= entity.maxUses) {
      return { valid: false, reason: 'Code has reached its usage limit' };
    }
    return { valid: true };
  }

  /**
   * Claim a referral code for a fan. This only records a *pending* redemption
   * — no reward is granted and the code's `useCount` is not incremented until
   * the fan's first `SubscriptionCreatedEvent` is attributed to it (see
   * {@link attributeForSubscriber}). Claiming is idempotent per (code, fan).
   */
  async redeemCode(
    redeemerId: string,
    dto: RedeemReferralCodeDto,
  ): Promise<ReferralRedemption> {
    return this.dataSource.transaction(async (manager) => {
      const entity = await manager.findOne(ReferralCode, {
        where: { code: dto.code },
        lock: { mode: 'pessimistic_write' },
      });

      if (!entity) throw new NotFoundException('Referral code not found');
      if (!entity.isActive)
        throw new BadRequestException('Referral code is no longer active');
      if (entity.ownerId === redeemerId) {
        throw new BadRequestException(
          'You cannot redeem your own referral code',
        );
      }
      if (entity.maxUses !== null && entity.useCount >= entity.maxUses) {
        throw new BadRequestException(
          'Referral code has reached its usage limit',
        );
      }

      const existing = await manager.findOne(ReferralRedemption, {
        where: { referralCodeId: entity.id, redeemerId },
      });
      if (existing)
        throw new ConflictException('You have already redeemed this code');

      const redemption = manager.create(ReferralRedemption, {
        referralCodeId: entity.id,
        redeemerId,
        subscriberAddress: dto.subscriberAddress ?? null,
        attributedAt: null,
      });
      return manager.save(ReferralRedemption, redemption);
    });
  }

  /**
   * Attribute a fan's pending referral claim to their first subscription.
   *
   * Invoked by the attribution consumer for each `SubscriptionCreatedEvent`.
   * `SubscriptionRenewedEvent` is deliberately not wired, so a renewal never
   * pays out again. This method is idempotent: replaying the same event, or
   * a later subscription to a different creator, is a no-op once the claim
   * is attributed.
   *
   * @returns the granted reward, or `null` when there is nothing to attribute.
   */
  async attributeForSubscriber(
    subscriberAddress: string,
  ): Promise<ReferralReward | null> {
    if (!subscriberAddress) return null;

    return this.dataSource.transaction(async (manager) => {
      const redemption = await manager.findOne(ReferralRedemption, {
        where: { subscriberAddress, attributedAt: IsNull() },
        order: { redeemedAt: 'ASC' },
      });
      if (!redemption) return null;

      const code = await manager.findOne(ReferralCode, {
        where: { id: redemption.referralCodeId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!code) {
        this.logger.warn(
          `Pending redemption ${redemption.id} references missing code ${redemption.referralCodeId}`,
        );
        return null;
      }

      // Fraud / integrity re-checks at attribution time.
      if (redemption.redeemerId === code.ownerId) {
        this.logger.warn(
          `Rejected self-referral attribution for code ${code.code}`,
        );
        return null;
      }
      if (!code.isActive) return null;
      if (code.maxUses !== null && code.useCount >= code.maxUses) return null;

      redemption.attributedAt = new Date();
      await manager.save(ReferralRedemption, redemption);

      code.useCount += 1;
      await manager.save(ReferralCode, code);

      const kind = resolveRewardKind();
      const reward = manager.create(ReferralReward, {
        redemptionId: redemption.id,
        beneficiaryId: code.ownerId,
        kind,
        amount: resolveRewardAmount(kind),
        status: 'GRANTED',
      });
      const saved = await manager.save(ReferralReward, reward);
      this.logger.log(
        `Attributed referral ${code.code} → reward ${saved.kind} ${saved.amount} for ${code.ownerId}`,
      );
      return saved;
    });
  }

  /** List redemptions for a code (owner only). */
  async listRedemptions(
    ownerId: string,
    codeId: string,
  ): Promise<ReferralRedemption[]> {
    const entity = await this.codesRepo.findOne({ where: { id: codeId } });
    if (!entity) throw new NotFoundException('Referral code not found');
    if (entity.ownerId !== ownerId)
      throw new ForbiddenException('Not your code');

    return this.redemptionsRepo.find({
      where: { referralCodeId: codeId },
      order: { redeemedAt: 'DESC' },
    });
  }

  /** List rewards earned by a user (as a referral code owner). */
  async listRewards(beneficiaryId: string): Promise<ReferralReward[]> {
    return this.rewardsRepo.find({
      where: { beneficiaryId },
      order: { createdAt: 'DESC' },
    });
  }
}
