import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('plan_metadata')
@Index('UQ_plan_metadata_plan_id', ['planId'], { unique: true })
export class PlanMetadata {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'plan_id', type: 'varchar', length: 128, unique: true })
  planId: string;

  @Column({ type: 'varchar', length: 128 })
  creator: string;

  @Column({ type: 'varchar', length: 12 })
  asset: string;

  @Column({ type: 'varchar', length: 64 })
  amount: string;

  @Column({ type: 'varchar', length: 16 })
  interval: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  title?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'created_at', type: 'varchar', length: 32 })
  createdAt: string;

  @Column({ name: 'updated_at', type: 'varchar', length: 32 })
  updatedAt: string;
}
