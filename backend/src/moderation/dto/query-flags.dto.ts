import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ContentType, ModerationStatus } from '../entities/moderation-flag.entity';
import { PaginationDto } from '../../common/dto';

export class QueryFlagsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ModerationStatus })
  @IsOptional()
  @IsEnum(ModerationStatus)
  status?: ModerationStatus;

  @ApiPropertyOptional({ enum: ContentType })
  @IsOptional()
  @IsEnum(ContentType)
  content_type?: ContentType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  content_id?: string;
}
