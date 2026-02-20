import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Creator } from '../../creators/entities/creator.entity';

export enum PostType {
  FREE = 'free',
  PAID = 'paid',
}

/**
 * Post entity - creator content. Draft when published_at is null; published when set.
 * Validation: price must be null when type=free; price >= 0 when type=paid.
 */
@Entity('posts')
@Index(['creator', 'published_at'])
@Index(['type'])
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Creator, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creator_id' })
  creator!: Creator;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  body!: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: PostType.FREE,
  })
  type!: PostType;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 6,
    nullable: true,
  })
  price!: string | null;

  @Column({
    name: 'media_urls',
    type: 'simple-json',
  })
  media_urls: string[] = [];

  @Column({ name: 'published_at', type: 'datetime', nullable: true })
  published_at!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  @BeforeInsert()
  @BeforeUpdate()
  validatePriceAndType() {
    if (this.type === PostType.FREE && this.price != null) {
      throw new Error('Price must be null when type is free');
    }
    if (this.type === PostType.PAID) {
      const p = parseFloat(this.price ?? '');
      if (isNaN(p) || p < 0) {
        throw new Error('Price must be >= 0 when type is paid');
      }
    }
  }
}
