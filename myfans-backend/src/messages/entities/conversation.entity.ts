import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('conversations')
@Index(['participant_1_id', 'participant_2_id'])
@Unique(['participant_1_id', 'participant_2_id'])
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  participant_1_id!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'participant_1_id' })
  participant_1!: User;

  @Column({ type: 'uuid' })
  participant_2_id!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'participant_2_id' })
  participant_2!: User;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
