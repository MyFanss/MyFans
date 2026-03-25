import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * SocialLinksResponseDto
 *
 * Nested object returned inside profile responses.
 */
export class SocialLinksResponseDto {
  @ApiPropertyOptional({ example: 'https://johndoe.com' })
  @Expose()
  websiteUrl: string | null;

  @ApiPropertyOptional({ example: 'johndoe' })
  @Expose()
  twitterHandle: string | null;

  @ApiPropertyOptional({ example: 'johndoe' })
  @Expose()
  instagramHandle: string | null;

  @ApiPropertyOptional({ example: 'https://linktr.ee/johndoe' })
  @Expose()
  otherLink: string | null;
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
