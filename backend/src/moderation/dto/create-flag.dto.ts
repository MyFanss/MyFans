import { IsEnum, IsUUID, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContentType, FlagReason } from '../entities/moderation-flag.entity';

export class CreateFlagDto {
  @ApiProperty({ enum: ContentType })
  @IsEnum(ContentType)
  content_type: ContentType;

  @ApiProperty({ description: 'UUID of the content being flagged' })
  @IsUUID()
  content_id: string;

  @ApiProperty({ enum: FlagReason })
  @IsEnum(FlagReason)
  reason: FlagReason;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
