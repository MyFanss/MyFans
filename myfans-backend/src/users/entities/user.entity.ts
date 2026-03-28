import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Creator } from '../../creators/entities/creator.entity';
import { Subscription } from '../../subscriptions/entities/subscription.entity';

/**
 * User entity. When is_creator is true, a corresponding Creator row must exist.
 * The Creator entity extends User with creator-specific fields (bio, subscription pricing, etc.).
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ default: false })
  is_creator!: boolean;

  @Column({ unique: true })
  email!: string;

  @Column({ type: 'varchar', unique: true, nullable: true })
  username!: string | null;

  @Column({ name: 'display_name', type: 'varchar', nullable: true })
  display_name!: string | null;

  @Column({ name: 'avatar_url', type: 'varchar', length: 2048, nullable: true })
  avatar_url!: string | null;

  /** Public website (https only in API validation) */
  @Column({ name: 'website_url', type: 'varchar', length: 2048, nullable: true })
  website_url!: string | null;

  /** X/Twitter handle (stored without @) */
  @Column({ name: 'x_handle', type: 'varchar', length: 32, nullable: true })
  x_handle!: string | null;

  /** Instagram handle (stored without @) */
  @Column({
    name: 'instagram_handle',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  instagram_handle!: string | null;

  /** Additional link (e.g. Linktree) */
  @Column({ name: 'other_url', type: 'varchar', length: 2048, nullable: true })
  other_url!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  @OneToOne(() => Creator, (creator) => creator.user, { cascade: true })
  creator?: Creator | null;

  @OneToMany(() => Subscription, (sub) => sub.fan)
  subscriptions?: Subscription[];
}
