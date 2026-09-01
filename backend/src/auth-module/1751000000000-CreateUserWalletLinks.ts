import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserWalletLinks1751000000000 implements MigrationInterface {
  name = 'CreateUserWalletLinks1751000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user_wallet_links" (
        "id"              uuid          NOT NULL DEFAULT gen_random_uuid(),
        "user_id"         uuid          NOT NULL,
        "stellarAddress"  varchar(56)   NOT NULL,
        "isPrimary"       boolean       NOT NULL DEFAULT false,
        "createdAt"       TIMESTAMP     NOT NULL DEFAULT now(),
        "verifiedAt"      timestamptz,
        CONSTRAINT "PK_user_wallet_links" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_wallet_links_stellarAddress" UNIQUE ("stellarAddress"),
        CONSTRAINT "FK_user_wallet_links_user_id" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_user_wallet_links_user_id" ON "user_wallet_links" ("user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "user_wallet_links"`);
  }
}
