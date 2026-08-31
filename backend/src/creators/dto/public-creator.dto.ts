import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../users/entities/user.entity';
import { Creator } from '../entities/creator.entity';

export class PublicCreatorDto {
  @ApiProperty({
    description: 'Creator user ID',
    example: 'user-123',
  })
  id: string;

  @ApiProperty({
    description: 'Creator display name',
    example: 'John Doe',
  })
  display_name: string;

  @ApiProperty({
    description: 'Creator username handle',
    example: 'johndoe',
  })
  username: string;

  @ApiProperty({
    description: 'Creator avatar URL',
    nullable: true,
    example: 'https://example.com/avatar.jpg',
  })
  avatar_url: string | null;

  @ApiProperty({
    description: 'Creator bio',
    nullable: true,
    example: 'I create amazing content',
  })
  bio: string | null;

  @ApiProperty({
    description: 'Whether the creator is verified',
    example: false,
  })
  is_verified: boolean;

  @ApiProperty({
    description: 'Number of followers',
    example: 0,
  })
  followers_count: number;

  /**
   * Personalized, viewer-scoped field: whether the *currently authenticated*
   * caller has favorited this creator. `null` for anonymous requests (no
   * JWT, or an invalid one) — never computed from another user's data, and
   * never populated for a request that isn't authenticated as the viewer.
   *
   * Deliberately not `@ApiProperty`'d with a static example tied to a user,
   * and never sourced from private account data (email, wallet address,
   * payout/balance) — this DTO is the only shape returned from the public
   * discover/creator-profile endpoints, authenticated or not.
   */
  @ApiProperty({
    description:
      'Whether the requesting (authenticated) user has favorited this creator. Null when the request is anonymous.',
    nullable: true,
    example: null,
  })
  isFavorited: boolean | null;

  constructor(user: User, creator?: Creator) {
    this.id = user.id;
    this.display_name = user.display_name;
    this.username = user.username;
    this.avatar_url = user.avatar_url;
    this.bio = creator?.bio ?? null;
    this.is_verified = creator?.is_verified ?? false;
    this.followers_count = creator?.followers_count ?? 0;
    this.isFavorited = null;
  }
}
