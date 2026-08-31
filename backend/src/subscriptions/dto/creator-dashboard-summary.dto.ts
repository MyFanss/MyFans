import { ApiProperty } from '@nestjs/swagger';

export class ActivityItemDto {
  @ApiProperty({ description: 'Unique activity ID' })
  id: string;

  @ApiProperty({ enum: ['subscription', 'renewal', 'cancellation'], description: 'Type of activity' })
  type: 'subscription' | 'renewal' | 'cancellation';

  @ApiProperty({ description: 'Human-readable title' })
  title: string;

  @ApiProperty({ description: 'Detailed description with participant info' })
  description: string;

  @ApiProperty({ description: 'ISO 8601 timestamp' })
  timestamp: string;

  @ApiProperty({ description: 'Optional metadata like amount', required: false })
  metadata?: string;
}

export class CreatorDashboardSummaryDto {
  @ApiProperty({ description: 'Total active subscribers (currently valid)', type: Number })
  totalSubscribers: number;

  @ApiProperty({ description: 'Percentage change in subscriber count vs. previous period', type: Number })
  totalSubscribersChangePercent: number;

  @ApiProperty({ description: 'Monthly Recurring Revenue in USD', type: Number })
  mrr: number;

  @ApiProperty({ description: 'Percentage change in MRR vs. previous period', type: Number })
  mrrChangePercent: number;

  @ApiProperty({ description: 'Total active subscriptions (for multi-plan creators)', type: Number })
  activeSubscriptions: number;

  @ApiProperty({ description: 'Percentage change in active subscriptions vs. previous period', type: Number })
  activeSubscriptionsChangePercent: number;

  @ApiProperty({ type: [ActivityItemDto], description: 'Recent activity (latest subscriptions, renewals, cancellations)' })
  recentActivity: ActivityItemDto[];
}
