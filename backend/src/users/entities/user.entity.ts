import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToOne,
  JoinColumn,
  DeleteDateColumn,
} from 'typeorm';
import { Creator } from '../../creators/entities/creator.entity';

import { UserRole } from '../../common/enums/user-role.enum';


@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  email: string;

  @Column({ unique: true })
  @Index()
  username: string;

  @Column()
  password_hash: string;

  @Column({ nullable: true })
  display_name: string;

  @Column({ nullable: true })
  avatar_url: string;

  // ── Notification channel preferences ──────────────────────────────────
  @Column({ type: 'boolean', default: true })
  email_notifications: boolean;

  @Column({ type: 'boolean', default: false })
  push_notifications: boolean;

  @Column({ type: 'boolean', default: false })
  marketing_emails: boolean;

  // ── Per-event toggles: email ───────────────────────────────────────────
  @Column({ type: 'boolean', default: true })
  email_new_subscriber: boolean;

  @Column({ type: 'boolean', default: true })
  email_subscription_renewal: boolean;

  @Column({ type: 'boolean', default: true })
  email_new_comment: boolean;

  @Column({ type: 'boolean', default: false })
  email_new_like: boolean;

  @Column({ type: 'boolean', default: true })
  email_new_message: boolean;

  @Column({ type: 'boolean', default: true })
  email_payout: boolean;

  // ── Per-event toggles: push ────────────────────────────────────────────
  @Column({ type: 'boolean', default: true })
  push_new_subscriber: boolean;

  @Column({ type: 'boolean', default: true })
  push_subscription_renewal: boolean;

  @Column({ type: 'boolean', default: true })
  push_new_comment: boolean;

  @Column({ type: 'boolean', default: true })
  push_new_like: boolean;

  @Column({ type: 'boolean', default: true })
  push_new_message: boolean;

  @Column({ type: 'boolean', default: false })
  push_payout: boolean;

@Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  @Column({ default: false })
  is_creator: boolean;

  @OneToOne(() => Creator, (creator) => creator.user, { nullable: true })
  @JoinColumn({ name: 'id' })
  creator?: Creator;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
  
  @DeleteDateColumn()
  deleted_at: Date;
}
