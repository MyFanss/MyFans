import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateContentUploadEvents1752000000000 implements MigrationInterface {
  name = 'CreateContentUploadEvents1752000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "content_upload_events" (
        "id"         uuid        NOT NULL DEFAULT gen_random_uuid(),
        "creator_id" varchar     NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_content_upload_events" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_content_upload_events_creator_created"
         ON "content_upload_events" ("creator_id", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "content_upload_events"`);
  }
}
