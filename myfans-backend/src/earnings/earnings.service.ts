import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Payment, PaymentStatus, PaymentType } from '../payments/entities/payment.entity';
import { Withdrawal, WithdrawalStatus, WithdrawalMethod } from './entities/withdrawal.entity';
import {
  EarningsSummaryDto,
  EarningsBreakdownDto,
  TransactionHistoryDto,
  WithdrawalRequestDto,
  WithdrawalDto,
  FeeTransparencyDto,
} from './dto/earnings-summary.dto';
import { PaginationQueryDto, PaginatedResponseDto } from '../common/dto';

@Injectable()
export class EarningsService {
  private readonly PROTOCOL_FEE_BPS = 500; // 5%
  private readonly WITHDRAWAL_FEE_FIXED = '1.00';
  private readonly WITHDRAWAL_FEE_PERCENTAGE = 0.02; // 2%

  constructor(
    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,
    @InjectRepository(Withdrawal)
    private readonly withdrawalsRepository: Repository<Withdrawal>,
  ) {}

  /**
   * Get total earnings summary for a creator
   */
  async getEarningsSummary(creatorId: string, days: number = 30): Promise<EarningsSummaryDto> {
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const payments = await this.paymentsRepository.find({
      where: {
        creator_id: creatorId,
        status: PaymentStatus.COMPLETED,
        created_at: Between(startDate, now),
      },
    });

    const totalEarnings = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const totalEarningsUsd = this.convertToUsd(totalEarnings, payments[0]?.currency || 'USD');

    const pendingPayments = await this.paymentsRepository.find({
      where: {
        creator_id: creatorId,
        status: PaymentStatus.PENDING,
      },
    });

    const pendingAmount = pendingPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);

    const withdrawals = await this.withdrawalsRepository.find({
      where: {
        user_id: creatorId,
        status: WithdrawalStatus.COMPLETED,
      },
    });

    const totalWithdrawn = withdrawals.reduce((sum, w) => sum + parseFloat(w.net_amount), 0);
    const availableForWithdrawal = totalEarnings - totalWithdrawn;

    return {
      total_earnings: totalEarnings.toFixed(6),
      total_earnings_usd: totalEarningsUsd,
      pending_amount: pendingAmount.toFixed(6),
      available_for_withdrawal: Math.max(0, availableForWithdrawal).toFixed(6),
      currency: payments[0]?.currency || 'USD',
      period_start: startDate.toISOString(),
      period_end: now.toISOString(),
    };
  }

  /**
   * Get earnings breakdown by time, plan, and asset
   */
  async getEarningsBreakdown(creatorId: string, days: number = 30): Promise<EarningsBreakdownDto> {
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const payments = await this.paymentsRepository.find({
      where: {
        creator_id: creatorId,
        status: PaymentStatus.COMPLETED,
        created_at: Between(startDate, now),
      },
    });

    // Group by date
    const byTimeMap = new Map<string, { amount: number; currency: string; count: number }>();
    payments.forEach((p) => {
      const date = p.created_at.toISOString().split('T')[0];
      const key = date;
      const existing = byTimeMap.get(key) || { amount: 0, currency: p.currency, count: 0 };
      existing.amount += parseFloat(p.amount);
      existing.count += 1;
      byTimeMap.set(key, existing);
    });

    const by_time = Array.from(byTimeMap.entries()).map(([date, data]) => ({
      date,
      amount: data.amount.toFixed(6),
      currency: data.currency,
      count: data.count,
    }));

    // Group by plan (mock - would need plan_id in Payment entity)
    const by_plan = [
      {
        plan_id: 'plan-1',
        plan_name: 'Basic',
        total_amount: (payments.filter((p) => p.type === PaymentType.SUBSCRIPTION).reduce((s, p) => s + parseFloat(p.amount), 0) * 0.6).toFixed(6),
        currency: 'USD',
        subscriber_count: Math.floor(payments.length * 0.6),
      },
      {
        plan_id: 'plan-2',
        plan_name: 'Pro',
        total_amount: (payments.filter((p) => p.type === PaymentType.SUBSCRIPTION).reduce((s, p) => s + parseFloat(p.amount), 0) * 0.4).toFixed(6),
        currency: 'USD',
        subscriber_count: Math.floor(payments.length * 0.4),
      },
    ];

    // Group by asset
    const byAssetMap = new Map<string, number>();
    payments.forEach((p) => {
      const existing = byAssetMap.get(p.currency) || 0;
      byAssetMap.set(p.currency, existing + parseFloat(p.amount));
    });

    const totalByAsset = Array.from(byAssetMap.values()).reduce((s, v) => s + v, 0);
    const by_asset = Array.from(byAssetMap.entries()).map(([asset, amount]) => ({
      asset,
      total_amount: amount.toFixed(6),
      percentage: totalByAsset > 0 ? (amount / totalByAsset) * 100 : 0,
    }));

    return { by_time, by_plan, by_asset };
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(
    creatorId: string,
    pagination: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<TransactionHistoryDto>> {
    const { page = 1, limit = 50 } = pagination;
    const skip = (page - 1) * limit;

    const [payments, total] = await this.paymentsRepository.findAndCount({
      where: { creator_id: creatorId },
      order: { created_at: 'DESC' },
      take: limit,
      skip,
    });

    const items = payments.map((p) => ({
      id: p.id,
      date: p.created_at.toISOString(),
      type: p.type as any,
      description: `${p.type} from subscriber`,
      amount: p.amount,
      currency: p.currency,
      status: p.status as any,
      reference_id: p.reference_id || undefined,
      tx_hash: p.tx_hash || undefined,
    }));

    return new PaginatedResponseDto(items, total, page, limit);
  }

  /**
   * Request withdrawal
   */
  async requestWithdrawal(creatorId: string, dto: WithdrawalRequestDto): Promise<WithdrawalDto> {
    const summary = await this.getEarningsSummary(creatorId);
    const available = parseFloat(summary.available_for_withdrawal);
    const requestAmount = parseFloat(dto.amount);

    if (requestAmount > available) {
      throw new BadRequestException(`Insufficient balance. Available: ${available}`);
    }

    if (requestAmount <= 0) {
      throw new BadRequestException('Withdrawal amount must be greater than 0');
    }

    const fee = this.calculateWithdrawalFee(requestAmount);
    const netAmount = requestAmount - fee;

    const withdrawal = this.withdrawalsRepository.create({
      user_id: creatorId,
      amount: requestAmount.toFixed(6),
      currency: dto.currency,
      status: WithdrawalStatus.PENDING,
      method: dto.method as WithdrawalMethod,
      destination_address: dto.destination_address,
      fee: fee.toFixed(6),
      net_amount: netAmount.toFixed(6),
    });

    const saved = await this.withdrawalsRepository.save(withdrawal);

    return this.mapWithdrawalToDto(saved);
  }

  /**
   * Get withdrawal history
   */
  async getWithdrawalHistory(
    creatorId: string,
    pagination: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<WithdrawalDto>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const [withdrawals, total] = await this.withdrawalsRepository.findAndCount({
      where: { user_id: creatorId },
      order: { created_at: 'DESC' },
      take: limit,
      skip,
    });

    return new PaginatedResponseDto(
      withdrawals.map((w) => this.mapWithdrawalToDto(w)),
      total,
      page,
      limit,
    );
  }

  /**
   * Get fee transparency info
   */
  getFeeTransparency(): FeeTransparencyDto {
    const exampleEarnings = 100;
    const protocolFee = (exampleEarnings * this.PROTOCOL_FEE_BPS) / 10000;
    const netEarnings = exampleEarnings - protocolFee;
    const withdrawalFee = parseFloat(this.WITHDRAWAL_FEE_FIXED) + netEarnings * this.WITHDRAWAL_FEE_PERCENTAGE;
    const finalAmount = netEarnings - withdrawalFee;

    return {
      protocol_fee_bps: this.PROTOCOL_FEE_BPS,
      protocol_fee_percentage: (this.PROTOCOL_FEE_BPS / 10000) * 100,
      withdrawal_fee_fixed: this.WITHDRAWAL_FEE_FIXED,
      withdrawal_fee_percentage: this.WITHDRAWAL_FEE_PERCENTAGE * 100,
      example_earnings: exampleEarnings.toFixed(2),
      example_protocol_fee: protocolFee.toFixed(2),
      example_net_earnings: netEarnings.toFixed(2),
      example_withdrawal_fee: withdrawalFee.toFixed(2),
      example_final_amount: finalAmount.toFixed(2),
    };
  }

  /**
   * Helper: Calculate withdrawal fee
   */
  private calculateWithdrawalFee(amount: number): number {
    return parseFloat(this.WITHDRAWAL_FEE_FIXED) + amount * this.WITHDRAWAL_FEE_PERCENTAGE;
  }

  /**
   * Helper: Convert to USD (mock)
   */
  private convertToUsd(amount: number, currency: string): number {
    const rates: Record<string, number> = {
      USD: 1,
      EUR: 1.1,
      GBP: 1.27,
      XLM: 0.12,
      USDC: 1,
    };
    return amount * (rates[currency] || 1);
  }

  /**
   * Helper: Map withdrawal entity to DTO
   */
  private mapWithdrawalToDto(withdrawal: Withdrawal): WithdrawalDto {
    return {
      id: withdrawal.id,
      amount: withdrawal.amount,
      currency: withdrawal.currency,
      status: withdrawal.status as any,
      created_at: withdrawal.created_at.toISOString(),
      completed_at: withdrawal.completed_at?.toISOString(),
      destination_address: withdrawal.destination_address,
      tx_hash: withdrawal.tx_hash || undefined,
      fee: withdrawal.fee,
      net_amount: withdrawal.net_amount,
    };
  }
}
