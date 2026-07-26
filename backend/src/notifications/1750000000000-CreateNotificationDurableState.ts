import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Backs the durable notification email queue (#1439) and the persisted
 * retry-queue/digest-window state (#1440), replacing what previously lived
 * only in `NotificationsService`'s in-memory Maps.
 */
export class CreateNotificationDurableState1750000000000 implements MigrationInterface {
  name = 'CreateNotificationDurableState1750000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "email_outbox_status_enum" AS ENUM ('pending', 'sent', 'failed');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "email_outbox" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "dedupe_key" varchar NOT NULL,
        "to_user_id" varchar NOT NULL,
        "subject" varchar NOT NULL,
        "body" text NOT NULL,
        "status" "email_outbox_status_enum" NOT NULL DEFAULT 'pending',
        "attempts" integer NOT NULL DEFAULT 0,
        "last_error" text,
        "sent_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_email_outbox" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_email_outbox_dedupe_key" UNIQUE ("dedupe_key")
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_email_outbox_status" ON "email_outbox" ("status");`,
    );

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "notification_retry_job_status_enum" AS ENUM ('pending', 'processing', 'completed', 'failed');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notification_retry_jobs" (
        "dedupe_key" varchar NOT NULL,
        "payload" jsonb NOT NULL,
        "attempts" integer NOT NULL DEFAULT 0,
        "status" "notification_retry_job_status_enum" NOT NULL DEFAULT 'pending',
        "last_error" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notification_retry_jobs" PRIMARY KEY ("dedupe_key")
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_notification_retry_jobs_status" ON "notification_retry_jobs" ("status");`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notification_digest_windows" (
        "digest_key" varchar NOT NULL,
        "notification_id" varchar NOT NULL,
        "event_times" jsonb NOT NULL,
        "window_expires_at" bigint NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notification_digest_windows" PRIMARY KEY ("digest_key")
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "notification_digest_windows";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notification_retry_jobs_status";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notification_retry_jobs";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "notification_retry_job_status_enum";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_email_outbox_status";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "email_outbox";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "email_outbox_status_enum";`);
  }
}
