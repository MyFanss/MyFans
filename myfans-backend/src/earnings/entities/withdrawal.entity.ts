import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum WithdrawalStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum WithdrawalMethod {
  WALLET = 'wallet',
  BANK = 'bank',
}

@Entity('withdrawals')
@Index(['user_id', 'created_at'])
@Index(['status'])
export class Withdrawal {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id' })
  user_id!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'decimal', precision: 18, scale: 6 })
  amount!: string;

  @Column({ length: 10 })
  currency!: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: WithdrawalStatus.PENDING,
  })
  status!: WithdrawalStatus;

  @Column({
    type: 'varchar',
    length: 10,
  })
  method!: WithdrawalMethod;

  @Column({ name: 'destination_address' })
  destination_address!: string;

  @Column({ type: 'decimal', precision: 18, scale: 6 })
  fee!: string;

  @Column({ type: 'decimal', precision: 18, scale: 6 })
  net_amount!: string;

  @Column({ name: 'tx_hash', type: 'varchar', nullable: true })
  tx_hash!: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  error_message!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completed_at!: Date | null;
}
