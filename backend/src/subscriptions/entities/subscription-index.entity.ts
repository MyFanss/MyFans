import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

export enum SubscriptionStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}
export type SubscriptionStatusType = SubscriptionStatus;

@Entity('subscription_index')
@Unique(['ledgerSeq', 'eventIndex'])
@Index(['fan', 'creator'])
@Index(['status'])
export class SubscriptionIndexEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('varchar', { length: 56 })
  fan!: string; // Stellar G-address

  @Column('varchar', { length: 56 })
  creator!: string;

  @Column('int')
  planId!: number;

@Column('bigint')
  expiryUnix!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.ACTIVE,
  })
  status!: SubscriptionStatus;

  @Column('bigint')
  ledgerSeq!: number;

  @Column('int')
  eventIndex!: number;

  @Column({ nullable: true })
  txHash?: string;

  @Column('varchar', { nullable: true })
  eventType!: 'subscribed' | 'extended' | 'cancelled'; // from topics

  @CreateDateColumn()
  indexedAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

