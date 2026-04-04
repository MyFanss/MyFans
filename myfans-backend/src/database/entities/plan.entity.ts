import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Check,
} from 'typeorm';
import { Creator } from './creator.entity';
import { Subscription } from './subscription.entity';

export enum BillingInterval {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

@Entity({ name: 'plans' })
@Index(['creator_id'])
@Index(['is_active'])
@Index(['creator_id', 'is_active'])
@Check(`"price_cents" >= 0`)
@Check(
  `"billing_interval" IN ('monthly', 'yearly')`,
)
export class Plan {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({
    type: 'uuid',
    nullable: false,
  })
  creator_id: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  name: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  description: string;

  @Column({
    type: 'integer',
    nullable: false,
  })
  price_cents: number;

  @Column({
    type: 'enum',
    enum: BillingInterval,
    default: BillingInterval.MONTHLY,
    nullable: false,
  })
  billing_interval: BillingInterval;

  @Column({
    type: 'boolean',
    default: true,
    nullable: false,
  })
  is_active: boolean;

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
  @ManyToOne(() => Creator, (creator) => creator.plans, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'creator_id' })
  creator: Creator;

  @OneToMany(() => Subscription, (subscription) => subscription.plan, {
    onDelete: 'CASCADE',
  })
  subscriptions: Subscription[];
}
