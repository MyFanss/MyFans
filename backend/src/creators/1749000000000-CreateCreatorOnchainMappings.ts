import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates `creator_onchain_mappings`, tracking the creator-registry
 * contract's `creator_id` (u64) against the off-chain `creators` row that
 * registered it (#1454).
 *
 * Safe to run against both fresh and existing databases — every statement is
 * conditional (`IF NOT EXISTS`) so a database that already picked up the
 * table via `synchronize` is left untouched.
 */
export class CreateCreatorOnchainMappings1749000000000 implements MigrationInterface {
  name = 'CreateCreatorOnchainMappings1749000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "creator_onchain_mappings" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "creator_id" uuid NOT NULL,
        "stellar_address" varchar(56) NOT NULL,
        "onchain_creator_id" varchar NOT NULL,
        "last_synced_at" TIMESTAMPTZ NOT NULL,
        "drift_detected_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_creator_onchain_mappings" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_creator_onchain_mappings_creator_id" UNIQUE ("creator_id"),
        CONSTRAINT "FK_creator_onchain_mappings_creator_id" FOREIGN KEY ("creator_id")
          REFERENCES "creators" ("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_creator_onchain_mappings_onchain_creator_id"
        ON "creator_onchain_mappings" ("onchain_creator_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_creator_onchain_mappings_onchain_creator_id";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "creator_onchain_mappings";`);
  }
}
