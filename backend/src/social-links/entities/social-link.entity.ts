import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  MAX_SOCIAL_LINK_PLATFORM_LENGTH,
  MAX_SOCIAL_LINK_URL_LENGTH,
} from '../social-links.service';

/**
 * Table name for the social link entity. Exported so the migration and
 * the migration integration test can reference the same source of truth
 * instead of duplicating the literal.
 */
export const SOCIAL_LINKS_TABLE = 'social_links';

@Entity(SOCIAL_LINKS_TABLE)
export class SocialLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 128 })
  userId: string;

  @Column({ type: 'varchar', length: MAX_SOCIAL_LINK_PLATFORM_LENGTH })
  platform: string;

  @Column({ type: 'varchar', length: MAX_SOCIAL_LINK_URL_LENGTH })
  url: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}