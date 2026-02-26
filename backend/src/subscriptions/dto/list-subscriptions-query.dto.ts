import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto';

export class ListSubscriptionsQueryDto extends PaginationDto {
  @IsString()
  @IsNotEmpty()
  fan: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  sort?: string;
}
