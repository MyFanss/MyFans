import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ModerationStatus } from '../entities/moderation-flag.entity';

const ALLOWED = [
  ModerationStatus.APPROVED,
  ModerationStatus.REJECTED,
  ModerationStatus.UNDER_REVIEW,
];

export class ReviewFlagDto {
  @ApiProperty({ enum: ALLOWED, description: 'New moderation status' })
  @IsEnum(ALLOWED, { message: 'status must be approved, rejected, or under_review' })
  status: ModerationStatus;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  admin_notes?: string;
}
