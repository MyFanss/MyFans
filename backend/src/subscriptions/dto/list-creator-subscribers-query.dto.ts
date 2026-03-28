import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto';

export class ListCreatorSubscribersQueryDto extends PaginationDto {
  @IsString()
  @IsNotEmpty()
  creator: string;

  @IsOptional()
  @IsIn(['active', 'expired'])
  status?: 'active' | 'expired';
}

