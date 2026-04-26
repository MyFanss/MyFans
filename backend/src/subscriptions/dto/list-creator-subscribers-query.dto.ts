import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto';

export const SUBSCRIBER_SORT_VALUES = ['created', 'expiry'] as const;
export type SubscriberSort = (typeof SUBSCRIBER_SORT_VALUES)[number];

export class ListCreatorSubscribersQueryDto extends PaginationDto {
  @ApiProperty({ description: 'Creator Stellar G-address' })
  @IsString()
  @IsNotEmpty()
  creator: string;

  @ApiPropertyOptional({ description: 'Filter by subscriber status', enum: ['active', 'expired'] })
  @IsOptional()
  @IsIn(['active', 'expired'])
  status?: 'active' | 'expired';

  @ApiPropertyOptional({ description: 'Sort field', enum: SUBSCRIBER_SORT_VALUES })
  @IsOptional()
  @IsIn(SUBSCRIBER_SORT_VALUES, { message: `sort must be one of: ${SUBSCRIBER_SORT_VALUES.join(', ')}` })
  sort?: SubscriberSort;
}
