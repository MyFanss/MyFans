import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('likes')
@Unique('UQ_likes_user_target', ['userId', 'targetId'])
@Index('IDX_likes_target', ['targetId'])
export class Like {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  targetId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
