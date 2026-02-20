import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Creator } from '../../creators/entities/creator.entity';

export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum PaymentType {
  SUBSCRIPTION = 'subscription',
  POST_PURCHASE = 'post_purchase',
  TIP = 'tip',
}

@Entity('payments')
@Index(['user_id', 'created_at'])
@Index(['creator_id', 'created_at'])
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id' })
  user_id!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'creator_id' })
  creator_id!: string;

  @ManyToOne(() => Creator)
  @JoinColumn({ name: 'creator_id' })
  creator!: Creator;

  @Column({ type: 'decimal', precision: 18, scale: 6 })
  amount!: string;

  @Column({ length: 10 })
  currency!: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: PaymentStatus.PENDING,
  })
  status!: PaymentStatus;

  @Column({
    type: 'varchar',
    length: 20,
  })
  type!: PaymentType;

  @Column({ name: 'reference_id', type: 'varchar', nullable: true })
  reference_id!: string | null;

  @Column({ name: 'tx_hash', type: 'varchar', nullable: true })
  tx_hash!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;
}
