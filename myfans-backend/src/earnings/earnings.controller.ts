import { Controller, Get, Post, Body, Query, UseGuards, Req } from '@nestjs/common';
import { EarningsService } from './earnings.service';
import { WithdrawalRequestDto } from './dto/earnings-summary.dto';
import { AuthGuard } from '../auth/auth.guard';

@Controller('earnings')
@UseGuards(AuthGuard)
export class EarningsController {
  constructor(private readonly earningsService: EarningsService) {}

  @Get('summary')
  async getSummary(@Query('days') days: string = '30', @Req() req: any) {
    const creatorId = req.user?.id;
    if (!creatorId) {
      throw new Error('Unauthorized');
    }
    return this.earningsService.getEarningsSummary(creatorId, parseInt(days, 10));
  }

  @Get('breakdown')
  async getBreakdown(@Query('days') days: string = '30', @Req() req: any) {
    const creatorId = req.user?.id;
    if (!creatorId) {
      throw new Error('Unauthorized');
    }
    return this.earningsService.getEarningsBreakdown(creatorId, parseInt(days, 10));
  }

  @Get('transactions')
  async getTransactions(
    @Query('limit') limit: string = '50',
    @Query('offset') offset: string = '0',
    @Req() req: any,
  ) {
    const creatorId = req.user?.id;
    if (!creatorId) {
      throw new Error('Unauthorized');
    }
    return this.earningsService.getTransactionHistory(creatorId, parseInt(limit, 10), parseInt(offset, 10));
  }

  @Get('withdrawals')
  async getWithdrawals(
    @Query('limit') limit: string = '20',
    @Query('offset') offset: string = '0',
    @Req() req: any,
  ) {
    const creatorId = req.user?.id;
    if (!creatorId) {
      throw new Error('Unauthorized');
    }
    return this.earningsService.getWithdrawalHistory(creatorId, parseInt(limit, 10), parseInt(offset, 10));
  }

  @Post('withdraw')
  async requestWithdrawal(@Body() dto: WithdrawalRequestDto, @Req() req: any) {
    const creatorId = req.user?.id;
    if (!creatorId) {
      throw new Error('Unauthorized');
    }
    return this.earningsService.requestWithdrawal(creatorId, dto);
  }

  @Get('fees')
  async getFeeTransparency() {
    return this.earningsService.getFeeTransparency();
  }
}
