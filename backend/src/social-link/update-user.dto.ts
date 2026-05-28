import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { SocialLinksDto } from './social-links.dto';
import { Type } from 'class-transformer';

/**
 * UpdateUserDto
 *
 * Extend your existing UpdateUserDto with SocialLinksDto.
 * Replace the "extends" base class with your actual base DTO.
 */
export class UpdateUserDto extends SocialLinksDto {
  // ── Example existing fields – keep whatever your actual DTO already has ──
  @ApiPropertyOptional({ example: 'John' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ example: 'Game developer & streamer' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;
}
