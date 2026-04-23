import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto';

export class ListSubscriptionsQueryDto extends PaginationDto {
  @ApiProperty({ description: 'Fan Stellar G-address' })
  @IsString()
  @IsNotEmpty()
  fan: string;

  @ApiPropertyOptional({ description: 'Filter by status', enum: ['active', 'expired', 'cancelled'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Sort field', enum: ['created', 'expiry'] })
  @IsOptional()
  @IsString()
  sort?: string;
}
