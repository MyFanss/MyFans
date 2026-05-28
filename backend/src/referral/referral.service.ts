import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ReferralCode } from './entities/referral-code.entity';
import { ReferralRedemption } from './entities/referral-redemption.entity';
import { CreateReferralCodeDto } from './dto/create-referral-code.dto';
import { RedeemReferralCodeDto } from './dto/redeem-referral-code.dto';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O/0/I/1 ambiguity
const CODE_LENGTH = 8;

function generateCode(): string {
  return Array.from({ length: CODE_LENGTH }, () =>
    CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)],
  ).join('');
}

@Injectable()
export class ReferralService {
  constructor(
    @InjectRepository(ReferralCode)
    private readonly codesRepo: Repository<ReferralCode>,
    @InjectRepository(ReferralRedemption)
    private readonly redemptionsRepo: Repository<ReferralRedemption>,
    private readonly dataSource: DataSource,
  ) {}

  /** Generate a unique referral code for a user. */
  async createCode(ownerId: string, dto: CreateReferralCodeDto): Promise<ReferralCode> {
    let code: string;
    let attempts = 0;

    do {
      code = generateCode();
      attempts++;
      if (attempts > 10) throw new ConflictException('Could not generate a unique code, try again');
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
    return this.codesRepo.find({ where: { ownerId }, order: { createdAt: 'DESC' } });
  }

  /** Deactivate a code (owner only). */
  async deactivateCode(ownerId: string, codeId: string): Promise<ReferralCode> {
    const entity = await this.codesRepo.findOne({ where: { id: codeId } });
    if (!entity) throw new NotFoundException('Referral code not found');
    if (entity.ownerId !== ownerId) throw new ForbiddenException('Not your code');

    entity.isActive = false;
    return this.codesRepo.save(entity);
  }

  /** Validate a code without redeeming it (used during checkout preview). */
  async validateCode(code: string): Promise<{ valid: boolean; reason?: string }> {
    const entity = await this.codesRepo.findOne({ where: { code } });
    if (!entity) return { valid: false, reason: 'Code not found' };
    if (!entity.isActive) return { valid: false, reason: 'Code is no longer active' };
    if (entity.maxUses !== null && entity.useCount >= entity.maxUses) {
      return { valid: false, reason: 'Code has reached its usage limit' };
    }
    return { valid: true };
  }

  /**
   * Redeem a referral code for a user.
   * Idempotent: a user can only redeem a given code once.
   */
  async redeemCode(redeemerId: string, dto: RedeemReferralCodeDto): Promise<ReferralRedemption> {
    return this.dataSource.transaction(async (manager) => {
      const entity = await manager.findOne(ReferralCode, {
        where: { code: dto.code },
        lock: { mode: 'pessimistic_write' },
      });

      if (!entity) throw new NotFoundException('Referral code not found');
      if (!entity.isActive) throw new BadRequestException('Referral code is no longer active');
      if (entity.ownerId === redeemerId) {
        throw new BadRequestException('You cannot redeem your own referral code');
      }
      if (entity.maxUses !== null && entity.useCount >= entity.maxUses) {
        throw new BadRequestException('Referral code has reached its usage limit');
      }

      const alreadyRedeemed = await manager.findOne(ReferralRedemption, {
        where: { referralCodeId: entity.id, redeemerId },
      });
      if (alreadyRedeemed) throw new ConflictException('You have already redeemed this code');

      entity.useCount += 1;
      await manager.save(ReferralCode, entity);

      const redemption = manager.create(ReferralRedemption, {
        referralCodeId: entity.id,
        redeemerId,
      });
      return manager.save(ReferralRedemption, redemption);
    });
  }

  /** List redemptions for a code (owner only). */
  async listRedemptions(ownerId: string, codeId: string): Promise<ReferralRedemption[]> {
    const entity = await this.codesRepo.findOne({ where: { id: codeId } });
    if (!entity) throw new NotFoundException('Referral code not found');
    if (entity.ownerId !== ownerId) throw new ForbiddenException('Not your code');

    return this.redemptionsRepo.find({
      where: { referralCodeId: codeId },
      order: { redeemedAt: 'DESC' },
    });
  }
}
