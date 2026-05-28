import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  FanSpendingCapEntity,
  CapPeriod,
} from '../entities/fan-spending-cap.entity';
import { SetSpendingCapDto, SpendingCapResponseDto } from '../dto/spending-cap.dto';

@Injectable()
export class SpendingCapService {
  constructor(
    @InjectRepository(FanSpendingCapEntity)
    private readonly repo: Repository<FanSpendingCapEntity>,
  ) {}

  async getCap(fanAddress: string): Promise<SpendingCapResponseDto | null> {
    const cap = await this.repo.findOne({ where: { fanAddress } });
    return cap ? this.toDto(cap) : null;
  }

  async setCap(fanAddress: string, dto: SetSpendingCapDto): Promise<SpendingCapResponseDto> {
    let cap = await this.repo.findOne({ where: { fanAddress } });
    if (!cap) {
      cap = this.repo.create({
        fanAddress,
        spentAmount: BigInt(0),
        periodStartedAt: new Date(),
      });
    }
    cap.capAmount = dto.capAmount != null ? BigInt(dto.capAmount) : null;
    cap.period = dto.period;
    // Reset period when cap is updated
    cap.spentAmount = BigInt(0);
    cap.periodStartedAt = new Date();
    return this.toDto(await this.repo.save(cap));
  }

  async removeCap(fanAddress: string): Promise<void> {
    await this.repo.delete({ fanAddress });
  }

  /**
   * Throws BadRequestException if the fan would exceed their cap.
   * Call this before confirming a checkout.
   */
  async assertWithinCap(fanAddress: string, amountStroops: bigint): Promise<void> {
    const cap = await this.repo.findOne({ where: { fanAddress } });
    if (!cap || cap.capAmount === null) return;

    this.resetPeriodIfExpired(cap);

    if (cap.spentAmount + amountStroops > cap.capAmount) {
      throw new BadRequestException(
        `Spending cap exceeded: limit ${cap.capAmount} stroops per ${cap.period}, ` +
        `spent ${cap.spentAmount}, requested ${amountStroops}`,
      );
    }
  }

  /**
   * Record a completed spend. Call after a checkout is confirmed.
   */
  async recordSpend(fanAddress: string, amountStroops: bigint): Promise<void> {
    const cap = await this.repo.findOne({ where: { fanAddress } });
    if (!cap) return;

    this.resetPeriodIfExpired(cap);
    cap.spentAmount += amountStroops;
    await this.repo.save(cap);
  }

  private resetPeriodIfExpired(cap: FanSpendingCapEntity): void {
    if (cap.period === CapPeriod.TOTAL || !cap.periodStartedAt) return;

    const now = new Date();
    const started = cap.periodStartedAt;
    const diffMs = now.getTime() - started.getTime();
    const periodMs = cap.period === CapPeriod.WEEKLY
      ? 7 * 24 * 3600 * 1000
      : 30 * 24 * 3600 * 1000;

    if (diffMs >= periodMs) {
      cap.spentAmount = BigInt(0);
      cap.periodStartedAt = now;
    }
  }

  private toDto(cap: FanSpendingCapEntity): SpendingCapResponseDto {
    return {
      fanAddress: cap.fanAddress,
      capAmount: cap.capAmount !== null ? cap.capAmount.toString() : null,
      period: cap.period,
      spentAmount: cap.spentAmount.toString(),
      periodStartedAt: cap.periodStartedAt?.toISOString() ?? null,
      updatedAt: cap.updatedAt.toISOString(),
    };
  }
}
