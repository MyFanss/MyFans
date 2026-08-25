import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Append-only audit trail for admin-privileged actions (#1568): role
 * changes and moderation decisions. Deliberately has no corresponding
 * update/delete path in application code.
 */
export class CreateAdminAuditEvents1751000000000 implements MigrationInterface {
  name = 'CreateAdminAuditEvents1751000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "admin_audit_events" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "actor_id" varchar NOT NULL,
        "action" varchar NOT NULL,
        "target" varchar NOT NULL,
        "payload_hash" varchar NOT NULL,
        "correlation_id" varchar,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_admin_audit_events" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_admin_audit_events_actor_id" ON "admin_audit_events" ("actor_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_admin_audit_events_target" ON "admin_audit_events" ("target");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_admin_audit_events_action" ON "admin_audit_events" ("action");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_admin_audit_events_correlation_id" ON "admin_audit_events" ("correlation_id");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "admin_audit_events";`);
  }
}
