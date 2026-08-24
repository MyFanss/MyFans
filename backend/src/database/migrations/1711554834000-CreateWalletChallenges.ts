import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWalletChallenges1711554834000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "wallet_challenges" (
        "id"              uuid              NOT NULL DEFAULT gen_random_uuid(),
        "stellarAddress"  character varying(56)  NOT NULL,
        "nonce"           character varying(128) NOT NULL,
        "expiresAt"       timestamptz       NOT NULL,
        "used"            boolean           NOT NULL DEFAULT false,
        "createdAt"       timestamptz       NOT NULL DEFAULT now(),
        CONSTRAINT "PK_wallet_challenges" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_wallet_challenges_nonce" UNIQUE ("nonce")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_wallet_challenges_address" ON "wallet_challenges" ("stellarAddress")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "wallet_challenges"`);
  }
}
