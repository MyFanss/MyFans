import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto';

export class ListCreatorSubscribersQueryDto extends PaginationDto {
  @ApiProperty({ description: 'Creator Stellar G-address' })
  @IsString()
  @IsNotEmpty()
  creator: string;

  @ApiPropertyOptional({ description: 'Filter by subscriber status', enum: ['active', 'expired'] })
  @IsOptional()
  @IsIn(['active', 'expired'])
  status?: 'active' | 'expired';
}
