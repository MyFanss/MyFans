import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * One row per successful content file upload, used to enforce a rolling
 * hourly per-creator upload quota (see `UploadQuotaService` and
 * `MAX_UPLOADS_PER_CREATOR_PER_HOUR`). Rows are disposable — a scheduled
 * job prunes anything older than the quota window.
 */
@Entity('content_upload_events')
@Index(['creator_id', 'created_at'])
export class ContentUploadEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** The uploading creator's user id (matches `content_metadata.creator_id`). */
  @Column({ name: 'creator_id' })
  creator_id!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at!: Date;
}
