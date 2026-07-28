import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * SocialLinksResponseDto
 *
 * Nested object returned inside profile responses.
 * All fields are optional because create/update endpoints return only the
 * fields that were supplied in the request body.
 */
export class SocialLinksResponseDto {
  @ApiPropertyOptional({ example: 'https://johndoe.com', nullable: true })
  @Expose()
  websiteUrl: string | null;

  @ApiPropertyOptional({ example: 'johndoe', nullable: true })
  @Expose()
  twitterHandle: string | null;

  @ApiPropertyOptional({ example: 'johndoe', nullable: true })
  @Expose()
  instagramHandle: string | null;

  @ApiPropertyOptional({ example: 'https://linktr.ee/johndoe', nullable: true })
  @Expose()
  otherLink: string | null;
}

/**
 * SocialLinksListItemDto
 *
 * Shape of each item returned by the GET /social-links list endpoint.
 * Extends SocialLinksResponseDto with a stable record ID. All link fields
 * are always present (never omitted), though each may be null.
 */
export class SocialLinksListItemDto extends SocialLinksResponseDto {
  @ApiProperty({ example: '1', description: 'Record ID' })
  @Expose()
  id: string;
}

/**
 * UserProfileDto
 *
 * Add/merge into your existing UserProfileDto.
 */
export class UserProfileDto {
  @ApiProperty({ example: 'uuid-here' })
  @Expose()
  id: string;

  @ApiProperty({ example: 'johndoe' })
  @Expose()
  username: string;

  @ApiPropertyOptional({ example: 'John Doe' })
  @Expose()
  displayName: string | null;

  @ApiPropertyOptional({ example: 'Game developer & streamer' })
  @Expose()
  bio: string | null;

  @ApiPropertyOptional({ type: () => SocialLinksResponseDto })
  @Expose()
  socialLinks: SocialLinksResponseDto;
}

/**
 * CreatorProfileDto (public-facing)
 *
 * Used in the public creator profile endpoint.
 */
export class CreatorProfileDto {
  @ApiProperty({ example: 'uuid-here' })
  @Expose()
  id: string;

  @ApiProperty({ example: 'johndoe' })
  @Expose()
  username: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/avatar.jpg' })
  @Expose()
  avatarUrl: string | null;

  @ApiPropertyOptional({ example: 'Game developer & streamer' })
  @Expose()
  bio: string | null;

  @ApiProperty({ example: 1500 })
  @Expose()
  followerCount: number;

  @ApiPropertyOptional({ type: () => SocialLinksResponseDto })
  @Expose()
  socialLinks: SocialLinksResponseDto;
}
