import { Column } from 'typeorm';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * SocialLinksMixin
 *
 * Apply this mixin to both the User and Creator entities so social link
 * columns are defined in a single place.
 *
 * Usage:
 *   @Entity()
 *   export class User extends SocialLinksMixin(BaseEntity) { ... }
 */
export function SocialLinksMixin<TBase extends new (...args: any[]) => {}>(Base: TBase) {
  abstract class SocialLinksBase extends Base {
    @ApiPropertyOptional({ example: 'https://mysite.com' })
    @Column({ name: 'website_url', type: 'varchar', length: 500, nullable: true, default: null })
    websiteUrl: string | null;

    @ApiPropertyOptional({ example: 'johndoe' })
    @Column({ name: 'twitter_handle', type: 'varchar', length: 50, nullable: true, default: null })
    twitterHandle: string | null;

    @ApiPropertyOptional({ example: 'johndoe' })
    @Column({ name: 'instagram_handle', type: 'varchar', length: 50, nullable: true, default: null })
    instagramHandle: string | null;

    @ApiPropertyOptional({ example: 'https://linktr.ee/johndoe' })
    @Column({ name: 'other_link', type: 'varchar', length: 500, nullable: true, default: null })
    otherLink: string | null;
  }

  return SocialLinksBase;
}
