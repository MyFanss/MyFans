import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class SubscriptionIndexerEventDto {
  @IsIn(['renewed', 'cancelled'])
  event: 'renewed' | 'cancelled';

  @IsString()
  subscriptionId: string;

  @IsString()
  userId: string;

  @IsString()
  creatorId: string;

  @IsInt()
  @Min(1)
  planId: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  expiry?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  cancelledAt?: number;
}
