import { QueryRunner } from 'typeorm';
import { AddRoleToUsers1747000000000 } from './1747000000000-AddRoleToUsers';

describe('AddRoleToUsers1747000000000', () => {
  let migration: AddRoleToUsers1747000000000;
  let queries: string[];
  let queryRunner: QueryRunner;

  const normalise = (sql: string) => sql.replace(/\s+/g, ' ').trim();

  beforeEach(() => {
    migration = new AddRoleToUsers1747000000000();
    queries = [];
    queryRunner = {
      query: jest.fn((sql: string) => {
        queries.push(normalise(sql));
        return Promise.resolve([]);
      }),
    } as unknown as QueryRunner;
  });

  it('is registered under its own timestamped name', () => {
    expect(migration.name).toBe('AddRoleToUsers1747000000000');
  });

  describe('up', () => {
    beforeEach(async () => {
      await migration.up(queryRunner);
    });

    it('creates the role enum type only when it does not already exist', () => {
      const create = queries.find((q) => q.includes('CREATE TYPE'));
      expect(create).toBeDefined();
      expect(create).toContain(
        "IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'users_role_enum')",
      );
      expect(create).toContain(
        `CREATE TYPE "users_role_enum" AS ENUM ('USER', 'CREATOR', 'ADMIN')`,
      );
    });

    it('adds users.role as NOT NULL with a USER default', () => {
      expect(queries).toContain(
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" "users_role_enum" NOT NULL DEFAULT 'USER'`,
      );
    });

    it('is re-runnable against a database that already has the column', () => {
      // Every DDL statement is guarded, so a second run is a no-op rather than
      // an error on existing databases.
      const ddl = queries.filter(
        (q) => q.includes('CREATE TYPE') || q.includes('ADD COLUMN'),
      );
      expect(ddl).toHaveLength(2);
      ddl.forEach((q) => expect(q).toMatch(/IF NOT EXISTS/));
    });

    it('backfills creators only when the legacy is_creator column is present', () => {
      const backfill = queries.find((q) => q.includes('UPDATE "users"'));
      expect(backfill).toBeDefined();
      expect(backfill).toContain(`column_name = 'is_creator'`);
      expect(backfill).toContain(
        `UPDATE "users" SET "role" = 'CREATOR' WHERE "is_creator" = true AND "role" = 'USER'`,
      );
    });
  });

  describe('down', () => {
    beforeEach(async () => {
      await migration.down(queryRunner);
    });

    it('drops the column before the enum type it depends on', () => {
      expect(queries).toEqual([
        `ALTER TABLE "users" DROP COLUMN IF EXISTS "role"`,
        `DROP TYPE IF EXISTS "users_role_enum"`,
      ]);
    });
  });
});
