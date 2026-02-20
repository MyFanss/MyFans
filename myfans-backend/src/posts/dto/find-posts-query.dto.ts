import { IsOptional, IsEnum, IsNumber, Min, Max, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { PostType } from '../entities/post.entity';

export class FindPostsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsUUID()
  creator_id?: string;

  @IsOptional()
  @IsEnum(PostType)
  type?: PostType;
}
