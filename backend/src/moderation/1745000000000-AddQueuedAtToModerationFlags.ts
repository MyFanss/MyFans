import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `queued_at` to `moderation_flags`.
 * Backfills existing rows with their `created_at` value so SLA age
 * calculations are meaningful for pre-existing flags.
 */
export class AddQueuedAtToModerationFlags1745000000000 implements MigrationInterface {
  name = 'AddQueuedAtToModerationFlags1745000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "moderation_flags"
      ADD COLUMN IF NOT EXISTS "queued_at" TIMESTAMP NULL
    `);

    // Backfill: use created_at as the baseline queue entry time
    await queryRunner.query(`
      UPDATE "moderation_flags"
      SET "queued_at" = "created_at"
      WHERE "queued_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_moderation_flags_queued_at"
      ON "moderation_flags" ("queued_at")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_moderation_flags_queued_at"
    `);
    await queryRunner.query(`
      ALTER TABLE "moderation_flags"
      DROP COLUMN IF EXISTS "queued_at"
    `);
  }
}
