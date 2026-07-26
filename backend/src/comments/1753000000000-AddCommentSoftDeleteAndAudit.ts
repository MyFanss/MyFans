import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCommentSoftDeleteAndAudit1753000000000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "comments"
      ADD COLUMN "deletedAt" TIMESTAMP NULL,
      ADD COLUMN "deletedBy" character varying NULL
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_comments_deletedAt" ON "comments" ("deletedAt")`,
    );

    await queryRunner.query(`
      CREATE TABLE "comment_audit_logs" (
        "id"         uuid              NOT NULL DEFAULT uuid_generate_v4(),
        "commentId"  character varying NOT NULL,
        "deletedBy"  character varying NOT NULL,
        "action"     character varying NOT NULL DEFAULT 'soft_delete',
        "createdAt"  TIMESTAMP         NOT NULL DEFAULT now(),
        CONSTRAINT "PK_comment_audit_logs" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_comment_audit_logs_commentId" ON "comment_audit_logs" ("commentId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_comment_audit_logs_deletedBy" ON "comment_audit_logs" ("deletedBy")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_comment_audit_logs_deletedBy"`);
    await queryRunner.query(`DROP INDEX "IDX_comment_audit_logs_commentId"`);
    await queryRunner.query(`DROP TABLE "comment_audit_logs"`);

    await queryRunner.query(`DROP INDEX "IDX_comments_deletedAt"`);
    await queryRunner.query(`
      ALTER TABLE "comments"
      DROP COLUMN "deletedBy",
      DROP COLUMN "deletedAt"
    `);
  }
}
