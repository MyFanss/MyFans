import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('comments')
export class Comment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  content: string;

  @Column()
  authorId: string;

  @Column()
  postId: string;

  @Column({ nullable: true })
  parentId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /** Soft-delete timestamp. Null when the comment is active. */
  @DeleteDateColumn({ nullable: true })
  deletedAt: Date | null;

  /** ID of the user who performed the soft delete (audit trail). */
  @Column({ nullable: true, type: 'varchar' })
  deletedBy: string | null;
}
