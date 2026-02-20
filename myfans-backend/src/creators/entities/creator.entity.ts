import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Subscription } from '../../subscriptions/entities/subscription.entity';

/**
 * Creator entity - one-to-one extension of User when user.is_creator is true.
 * Cascades delete when User is deleted. user.is_creator should match existence of Creator row.
 */
@Entity('creators')
export class Creator {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', unique: true })
  user_id!: string;

  @OneToOne(() => User, (user) => user.creator, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'text', nullable: true })
  bio!: string | null;

  @Column({
    name: 'subscription_price',
    type: 'decimal',
    precision: 18,
    scale: 6,
    default: 0,
  })
  subscription_price!: string;

  @Column({ length: 10, default: 'XLM' })
  currency!: string;

  @Column({ name: 'is_verified', default: false })
  is_verified!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  @OneToMany(() => Subscription, (sub) => sub.creator)
  subscriptions?: Subscription[];
}
