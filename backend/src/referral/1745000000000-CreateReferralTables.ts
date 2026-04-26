import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateReferralTables1745000000000 implements MigrationInterface {
  name = 'CreateReferralTables1745000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "referral_codes" (
        "id"          uuid              NOT NULL DEFAULT uuid_generate_v4(),
        "owner_id"    uuid              NOT NULL,
        "code"        character varying(20) NOT NULL,
        "max_uses"    integer,
        "use_count"   integer           NOT NULL DEFAULT 0,
        "is_active"   boolean           NOT NULL DEFAULT true,
        "created_at"  TIMESTAMP         NOT NULL DEFAULT now(),
        "updated_at"  TIMESTAMP         NOT NULL DEFAULT now(),
        CONSTRAINT "PK_referral_codes" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_referral_codes_code" UNIQUE ("code")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_referral_codes_owner_id" ON "referral_codes" ("owner_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_referral_codes_code" ON "referral_codes" ("code")`);

    await queryRunner.query(`
      CREATE TABLE "referral_redemptions" (
        "id"               uuid      NOT NULL DEFAULT uuid_generate_v4(),
        "referral_code_id" uuid      NOT NULL,
        "redeemer_id"      uuid      NOT NULL,
        "redeemed_at"      TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_referral_redemptions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_referral_redemptions_code_redeemer"
          UNIQUE ("referral_code_id", "redeemer_id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_referral_redemptions_code_id" ON "referral_redemptions" ("referral_code_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_referral_redemptions_redeemer_id" ON "referral_redemptions" ("redeemer_id")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "referral_redemptions"`);
    await queryRunner.query(`DROP TABLE "referral_codes"`);
  }
}
