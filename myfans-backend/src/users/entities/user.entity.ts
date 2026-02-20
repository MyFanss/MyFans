import {
  Column,
  CreateDateColumn,
  Entity,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Creator } from '../../creators/entities/creator.entity';

/**
 * User entity. When is_creator is true, a corresponding Creator row must exist.
 * The Creator entity extends User with creator-specific fields (bio, subscription pricing, etc.).
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ default: false })
  is_creator!: boolean;

  @Column({ unique: true })
  email!: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  @OneToOne(() => Creator, (creator) => creator.user, { cascade: true })
  creator?: Creator | null;
}
