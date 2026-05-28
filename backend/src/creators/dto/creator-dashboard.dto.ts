import { IsOptional, IsIn, IsDateString } from 'class-validator';

export type TimeWindow = '7d' | '30d' | '90d' | 'all';

export class DashboardQueryDto {
  @IsOptional()
  @IsIn(['7d', '30d', '90d', 'all'])
  window?: TimeWindow = '30d';

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export interface RevenueBreakdown {
  planId: number;
  asset: string;
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  subscriptionCount: number;
}

export interface CreatorDashboardDto {
  creatorAddress: string;
  window: TimeWindow | 'custom';
  from: string;
  to: string;
  cachedAt: string;
  subscribers: {
    active: number;
    newInWindow: number;
    churned: number;
  };
  revenue: {
    grossTotal: number;
    feeTotal: number;
    netTotal: number;
    byPlan: RevenueBreakdown[];
  };
  plans: {
    id: number;
    asset: string;
    amount: number;
    intervalDays: number;
    activeSubscribers: number;
  }[];
}
