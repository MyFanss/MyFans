import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import {
  IsSafeUrl,
  IsSocialHandle,
  IsAllowedDomain,
  sanitizeUrl,
  normalizeHandle,
} from './social-links.validator';

/**
 * SocialLinksDto
 *
 * Embed or extend this DTO inside UpdateUserDto / UpdateCreatorDto.
 * All fields are optional to allow partial updates.
 */
export class SocialLinksDto {
  @ApiPropertyOptional({
    description: 'Personal or brand website. Must be http/https.',
    example: 'https://johndoe.com',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @IsSafeUrl({ message: 'website_url must be a valid http or https URL' })
  @IsAllowedDomain({ message: 'website_url domain is not allowed. Allowed: twitter.com, instagram.com, linkedin.com' })
  @Transform(({ value }) => {
    const sanitized = sanitizeUrl(value);
    return sanitized !== null ? sanitized : value ?? null;
  })
  websiteUrl?: string | null;

  @ApiPropertyOptional({
    description: 'Twitter/X handle without @ (or with @).',
    example: 'johndoe',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @IsSocialHandle({ message: 'twitter_handle must be a valid social handle' })
  @Transform(({ value }) => normalizeHandle(value))
  twitterHandle?: string | null;

  @ApiPropertyOptional({
    description: 'Instagram handle without @ (or with @).',
    example: 'johndoe',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @IsSocialHandle({ message: 'instagram_handle must be a valid social handle' })
  @Transform(({ value }) => normalizeHandle(value))
  instagramHandle?: string | null;

  @ApiPropertyOptional({
    description: 'Any other link (Linktree, portfolio, etc.). Must be http/https.',
    example: 'https://linktr.ee/johndoe',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @IsSafeUrl({ message: 'other_link must be a valid http or https URL' })
  @IsAllowedDomain({ message: 'other_link domain is not allowed. Allowed: twitter.com, instagram.com, linkedin.com' })
  @Transform(({ value }) => {
    const sanitized = sanitizeUrl(value);
    return sanitized !== null ? sanitized : value ?? null;
  })
  otherLink?: string | null;
}
