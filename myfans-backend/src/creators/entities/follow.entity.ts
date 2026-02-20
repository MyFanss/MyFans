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
import { Creator } from './creator.entity';

@Entity('follows')
@Index(['follower_id', 'creator_id'], { unique: true })
export class Follow {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'follower_id' })
  follower_id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'follower_id' })
  follower!: User;

  @Column({ name: 'creator_id' })
  creator_id!: string;

  @ManyToOne(() => Creator, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creator_id' })
  creator!: Creator;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;
}
