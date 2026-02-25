import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Conversation } from './conversation.entity';
import { User } from '../../users/entities/user.entity';

@Entity('messages')
@Index(['conversation_id', 'created_at'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  conversation_id!: string;

  @ManyToOne(() => Conversation)
  @JoinColumn({ name: 'conversation_id' })
  conversation!: Conversation;

  @Column({ type: 'uuid' })
  sender_id!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'sender_id' })
  sender!: User;

  @Column({ type: 'text' })
  body!: string;

  @Column({ type: 'datetime', nullable: true })
  read_at!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;
}
