import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ContentType {
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
}

@Entity('content_metadata')
@Index(['creator_id'])
export class ContentMetadata {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'creator_id' })
  creator_id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'ipfs_cid' })
  ipfs_cid: string;

  @Column({ name: 'ipfs_url', nullable: true })
  ipfs_url: string | null;

  @Column({ type: 'enum', enum: ContentType, default: ContentType.IMAGE })
  content_type: ContentType;

  /** Optional subscription tier required to access this content */
  @Column({ name: 'subscription_tier', nullable: true })
  subscription_tier: string | null;

  @Column({ default: false })
  is_published: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
