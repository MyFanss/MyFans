import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('wallet_challenges')
export class WalletChallenge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 56 })
  @Index()
  stellarAddress: string;

  @Column({ unique: true, length: 128 })
  nonce: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ default: false })
  used: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
