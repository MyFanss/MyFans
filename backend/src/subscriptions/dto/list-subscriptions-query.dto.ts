import { IsEnum, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto';
import { SubscriptionStatus } from '../entities/subscription-index.entity';

export const SUBSCRIPTION_SORT_VALUES = ['created', 'expiry'] as const;
export type SubscriptionSort = (typeof SUBSCRIPTION_SORT_VALUES)[number];

export class ListSubscriptionsQueryDto extends PaginationDto {
  @ApiProperty({ description: 'Fan Stellar G-address' })
  @IsString()
  @IsNotEmpty()
  fan: string;

  @ApiPropertyOptional({ description: 'Filter by status', enum: SubscriptionStatus })
  @IsOptional()
  @IsEnum(SubscriptionStatus, {
    message: `status must be one of: ${Object.values(SubscriptionStatus).join(', ')}`,
  })
  status?: SubscriptionStatus;

  @ApiPropertyOptional({ description: 'Sort field', enum: SUBSCRIPTION_SORT_VALUES })
  @IsOptional()
  @IsIn(SUBSCRIPTION_SORT_VALUES, { message: `sort must be one of: ${SUBSCRIPTION_SORT_VALUES.join(', ')}` })
  sort?: SubscriptionSort;
}
