import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds subscription-driven attribution to the referral tables:
 *
 *  - `referral_redemptions` gains `subscriber_address` (the claiming fan's
 *    Stellar G-address, captured at checkout) and `attributed_at` (null until
 *    the first `SubscriptionCreatedEvent` is matched to the claim).
 *  - `referral_rewards` records the off-chain payout (credit or fee discount)
 *    granted to the code owner once a claim is attributed.
 */
export class AddReferralAttribution1745500000000 implements MigrationInterface {
  name = 'AddReferralAttribution1745500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "referral_redemptions" ADD COLUMN "subscriber_address" character varying(56)`,
    );
    await queryRunner.query(
      `ALTER TABLE "referral_redemptions" ADD COLUMN "attributed_at" TIMESTAMP`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_referral_redemptions_subscriber_address" ON "referral_redemptions" ("subscriber_address")`,
    );

    await queryRunner.query(`
      CREATE TABLE "referral_rewards" (
        "id"             uuid                  NOT NULL DEFAULT uuid_generate_v4(),
        "redemption_id"  uuid                  NOT NULL,
        "beneficiary_id" uuid                  NOT NULL,
        "kind"           character varying(32) NOT NULL,
        "amount"         numeric(20,7)         NOT NULL,
        "status"         character varying(16) NOT NULL DEFAULT 'GRANTED',
        "created_at"     TIMESTAMP             NOT NULL DEFAULT now(),
        CONSTRAINT "PK_referral_rewards" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_referral_rewards_redemption_id" UNIQUE ("redemption_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_referral_rewards_beneficiary_id" ON "referral_rewards" ("beneficiary_id")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "referral_rewards"`);
    await queryRunner.query(
      `DROP INDEX "IDX_referral_redemptions_subscriber_address"`,
    );
    await queryRunner.query(
      `ALTER TABLE "referral_redemptions" DROP COLUMN "attributed_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "referral_redemptions" DROP COLUMN "subscriber_address"`,
    );
  }
}
