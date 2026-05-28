import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
} from 'typeorm';
import { Like } from '../../likes/entities/like.entity';

@Entity('posts')
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column()
  authorId: string;

  @Column({ default: false })
  isPublished: boolean;

  @Column({ default: false })
  isPremium: boolean;

  @Column({ default: 0 })
  likesCount: number;

  @OneToMany(() => Like, (like) => like.post)
  likes: Like[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /** Soft-delete timestamp. Null when the post is active. */
  @DeleteDateColumn({ nullable: true })
  deletedAt: Date | null;

  /** ID of the user who performed the soft delete (audit trail). */
  @Column({ nullable: true, type: 'varchar' })
  deletedBy: string | null;
}
