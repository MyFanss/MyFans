import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
  Unique,
  Check,
} from 'typeorm';
import { Subscription } from './subscription.entity';

@Entity({ name: 'users' })
@Index(['email'], { unique: true })
@Index(['username'], { unique: true })
@Index(['created_at'])
@Unique(['email'])
@Unique(['username'])
@Check(`"is_active" IN (true, false)`)
export class User {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
    unique: true,
  })
  email: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: false,
    unique: true,
  })
  username: string;

  @Column({
    type: 'text',
    nullable: false,
  })
  password_hash: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  display_name: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  bio: string;

  @Column({
    type: 'varchar',
    length: 2083,
    nullable: true,
  })
  avatar_url: string;

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
  @OneToMany(() => Subscription, (subscription) => subscription.user, {
    onDelete: 'CASCADE',
  })
  subscriptions: Subscription[];
}
