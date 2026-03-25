import { IsOptional, IsEnum, IsUUID } from 'class-validator';
import { PostType } from '../entities/post.entity';
import { PaginationQueryDto } from '../../common/dto';

export class FindPostsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  creator_id?: string;

  @IsOptional()
  @IsEnum(PostType)
  type?: PostType;
}
