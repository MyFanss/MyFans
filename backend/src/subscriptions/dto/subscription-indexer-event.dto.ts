import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubscriptionIndexerEventDto {
  @ApiProperty({ enum: ['renewed', 'cancelled'] })
  @IsIn(['renewed', 'cancelled'])
  event: 'renewed' | 'cancelled';

  @ApiProperty()
  @IsString()
  subscriptionId: string;

  @ApiProperty({ description: 'Fan Stellar G-address' })
  @IsString()
  userId: string;

  @ApiProperty({ description: 'Creator Stellar G-address' })
  @IsString()
  creatorId: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  planId: number;

  @ApiPropertyOptional({ description: 'Expiry Unix timestamp (seconds)', minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  expiry?: number;

  @ApiPropertyOptional({ description: 'Cancellation Unix timestamp (seconds)', minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  cancelledAt?: number;
}
