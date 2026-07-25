import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('social_links')
export class SocialLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'website_url', type: 'varchar', length: 500, nullable: true, default: null })
  websiteUrl: string | null;

  @Column({ name: 'twitter_handle', type: 'varchar', length: 50, nullable: true, default: null })
  twitterHandle: string | null;

  @Column({ name: 'instagram_handle', type: 'varchar', length: 50, nullable: true, default: null })
  instagramHandle: string | null;

  @Column({ name: 'other_link', type: 'varchar', length: 500, nullable: true, default: null })
  otherLink: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
