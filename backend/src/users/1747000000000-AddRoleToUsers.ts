import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the RBAC `role` column to `users` (see `UserRole`).
 *
 * The migration is safe to run against both fresh and existing databases:
 *  - the enum type and the column are only created when they are absent, so a
 *    database that already picked the column up via `synchronize` is untouched;
 *  - the column carries a `USER` default and is `NOT NULL`, which Postgres
 *    backfills for existing rows without a table rewrite;
 *  - rows already flagged `is_creator` are promoted to `CREATOR` so the new
 *    column agrees with the pre-RBAC flag.
 */
export class AddRoleToUsers1747000000000 implements MigrationInterface {
  name = 'AddRoleToUsers1747000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'users_role_enum') THEN
          CREATE TYPE "users_role_enum" AS ENUM ('USER', 'CREATOR', 'ADMIN');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" "users_role_enum" NOT NULL DEFAULT 'USER'`,
    );

    // Pre-RBAC databases track creators with the boolean `is_creator` flag.
    // Fresh databases created from the migrations alone do not have it yet.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'users'
            AND column_name = 'is_creator'
        ) THEN
          UPDATE "users" SET "role" = 'CREATOR'
          WHERE "is_creator" = true AND "role" = 'USER';
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "role"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "users_role_enum"`);
  }
}
