import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePostAuditLogs1746500000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "post_audit_logs" (
        "id"         uuid              NOT NULL DEFAULT uuid_generate_v4(),
        "postId"     character varying NOT NULL,
        "deletedBy"  character varying NOT NULL,
        "action"     character varying NOT NULL DEFAULT 'soft_delete',
        "createdAt"  TIMESTAMP         NOT NULL DEFAULT now(),
        CONSTRAINT "PK_post_audit_logs" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_post_audit_logs_postId"    ON "post_audit_logs" ("postId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_post_audit_logs_deletedBy" ON "post_audit_logs" ("deletedBy")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_post_audit_logs_deletedBy"`);
    await queryRunner.query(`DROP INDEX "IDX_post_audit_logs_postId"`);
    await queryRunner.query(`DROP TABLE "post_audit_logs"`);
  }
}
