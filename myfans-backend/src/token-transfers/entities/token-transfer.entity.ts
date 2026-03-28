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

export enum TransferDirection {
  INCOMING = 'incoming',
  OUTGOING = 'outgoing',
}

@Entity('token_transfers')
@Index(['sender_address', 'created_at'])
@Index(['receiver_address', 'created_at'])
@Index(['account_address', 'created_at'])
export class TokenTransfer {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'sender_address', type: 'varchar', length: 255 })
  sender_address!: string;

  @Column({ name: 'receiver_address', type: 'varchar', length: 255 })
  receiver_address!: string;

  @Column({ name: 'account_address', type: 'varchar', length: 255 })
  account_address!: string;

  @Column({ type: 'decimal', precision: 18, scale: 6 })
  amount!: string;

  @Column({ length: 20, default: 'TOKEN' })
  token_type!: string;

  @Column({
    type: 'varchar',
    length: 20,
  })
  direction!: TransferDirection;

  @Column({ name: 'tx_hash', type: 'varchar', length: 255 })
  tx_hash!: string;

  @Column({ name: 'contract_address', type: 'varchar', length: 255, nullable: true })
  contract_address!: string | null;

  @Column({ type: 'varchar', nullable: true })
  fee!: string | null;

  @Column({ type: 'varchar', nullable: true })
  net_amount!: string | null;

  @Column({ name: 'user_id', nullable: true })
  user_id!: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user!: User | null;

  @CreateDateColumn({ name: 'timestamp' })
  timestamp!: Date;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;
}
