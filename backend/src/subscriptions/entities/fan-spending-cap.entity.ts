import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  UpdateDateColumn,
} from 'typeorm';

export enum CapPeriod {
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  TOTAL = 'total',
}

@Entity('fan_spending_caps')
@Index(['fanAddress'], { unique: true })
export class FanSpendingCapEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('varchar', { length: 56 })
  fanAddress!: string;

  /** Maximum spend allowed in the period (in stroops / smallest unit). */
  @Column('bigint', { nullable: true })
  capAmount!: bigint | null;

  @Column({ type: 'enum', enum: CapPeriod, default: CapPeriod.MONTHLY })
  period!: CapPeriod;

  /** Accumulated spend in the current period (in stroops). */
  @Column('bigint', { default: 0 })
  spentAmount!: bigint;

  /** ISO timestamp when the current period started. */
  @Column({ type: 'timestamptz', nullable: true })
  periodStartedAt!: Date | null;

  @UpdateDateColumn()
  updatedAt!: Date;
}
