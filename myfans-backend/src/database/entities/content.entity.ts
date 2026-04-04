import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  Check,
} from 'typeorm';
import { Creator } from './creator.entity';

export enum ContentVisibility {
  PUBLIC = 'public',
  SUBSCRIBERS_ONLY = 'subscribers_only',
  PREMIUM = 'premium',
}

@Entity({ name: 'content' })
@Index(['creator_id'])
@Index(['visibility'])
@Index(['published_at'])
@Index(['creator_id', 'published_at'], { synchronize: false })
@Check(
  `"visibility" IN ('public', 'subscribers_only', 'premium')`,
)
export class Content {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({
    type: 'uuid',
    nullable: false,
  })
  creator_id: string;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: false,
  })
  title: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  body: string;

  @Column({
    type: 'varchar',
    length: 2083,
    nullable: true,
  })
  media_url: string;

  @Column({
    type: 'enum',
    enum: ContentVisibility,
    default: ContentVisibility.PUBLIC,
    nullable: false,
  })
  visibility: ContentVisibility;

  @Column({
    type: 'timestamp with time zone',
    nullable: true,
  })
  published_at: Date;

  @CreateDateColumn({
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
  })
  created_at: Date;

  @UpdateDateColumn({
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updated_at: Date;

  // Relations
  @ManyToOne(() => Creator, (creator) => creator.content, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'creator_id' })
  creator: Creator;
}
