 treasury-deposit-event
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
 main
import { PaginationDto } from '../../common/dto';
import { SubscriptionStatus } from '../subscriptions.service';

export class ListSubscriptionsQueryDto extends PaginationDto {
  @ApiProperty({ description: 'Fan Stellar G-address' })
  @IsString()
  @IsNotEmpty()
  fan: string;

  @ApiPropertyOptional({ description: 'Filter by status', enum: ['active', 'expired', 'cancelled'] })
  @IsOptional()
  @IsEnum(SubscriptionStatus, {
    message: `status must be one of: ${Object.values(SubscriptionStatus).join(', ')}`,
  })
  status?: SubscriptionStatus;

  @ApiPropertyOptional({ description: 'Sort field', enum: ['created', 'expiry'] })
  @IsOptional()
  @IsString()
  sort?: string;
}
