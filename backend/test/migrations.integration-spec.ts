/**
 * Migration integration test.
 *
 * Requires a running Postgres instance. In CI this is provided by the
 * `postgres` service container defined in .github/workflows/ci.yml.
 * Locally: `docker run --rm -p 5432:5432 -e POSTGRES_PASSWORD=test -e POSTGRES_DB=myfans_test postgres:16-alpine`
 *
 * Environment variables (all have defaults matching the CI service):
 *   DB_HOST     (default: localhost)
 *   DB_PORT     (default: 5432)
 *   DB_USER     (default: myfans_ci)
 *   DB_PASSWORD (default: myfans_ci)
 *   DB_NAME     (default: myfans_test)
 */
import 'reflect-metadata';
import { DataSource, QueryRunner } from 'typeorm';

// ── Migration classes (same order as migration.datasource.ts) ────────────────
import { CreateRefreshTokens1700000000000 } from '../src/refresh-module/1700000000000-CreateRefreshTokens';
import { AddSocialLinksToUser1700000000000 } from '../src/social-link/1700000000000-AddSocialLinksToUser';
import { CreateWalletChallenges1711554834000 } from '../src/auth/1711554834000-CreateWalletChallenges';
import { CreateIdempotencyKeys1711554835000 } from '../src/idempotency/1711554835000-CreateIdempotencyKeys';
import { AddQueuedAtToModerationFlags1745000000000 } from '../src/moderation/1745000000000-AddQueuedAtToModerationFlags';
import { CreateReferralTables1745000000000 } from '../src/referral/1745000000000-CreateReferralTables';

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildDataSource(): DataSource {
  return new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USER ?? 'myfans_ci',
    password: process.env.DB_PASSWORD ?? 'myfans_ci',
    database: process.env.DB_NAME ?? 'myfans_test',
    synchronize: false,
    logging: false,
    migrations: [
      CreateRefreshTokens1700000000000,
      AddSocialLinksToUser1700000000000,
      CreateWalletChallenges1711554834000,
      CreateIdempotencyKeys1711554835000,
      AddQueuedAtToModerationFlags1745000000000,
      CreateReferralTables1745000000000,
    ],
  });
}

async function tableExists(qr: QueryRunner, table: string): Promise<boolean> {
  const result = await qr.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1`,
    [table],
  );
  return result.length > 0;
}

async function columnExists(
  qr: QueryRunner,
  table: string,
  column: string,
): Promise<boolean> {
  const result = await qr.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column],
  );
  return result.length > 0;
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('Database migrations (integration)', () => {
  let ds: DataSource;
  let qr: QueryRunner;

  // Increase timeout — real DB operations can be slow in CI
  jest.setTimeout(60_000);

  beforeAll(async () => {
    ds = buildDataSource();
    await ds.initialize();
    qr = ds.createQueryRunner();

    // Enable uuid-ossp so uuid_generate_v4() works (needed by refresh_tokens)
    await qr.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    // Create a minimal `users` table that migrations depend on (FK target).
    // This mirrors what the ORM would create via synchronize in production.
    await qr.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id"            uuid          NOT NULL DEFAULT gen_random_uuid(),
        "email"         varchar(255)  NOT NULL,
        "username"      varchar(50)   NOT NULL,
        "password_hash" varchar(255)  NOT NULL,
        "first_name"    varchar(100),
        "last_name"     varchar(100),
        "created_at"    timestamptz   NOT NULL DEFAULT now(),
        "updated_at"    timestamptz   NOT NULL DEFAULT now(),
        "deleted_at"    timestamptz,
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);

    // Create a minimal `moderation_flags` table for the queued_at migration
    await qr.query(`
      CREATE TABLE IF NOT EXISTS "moderation_flags" (
        "id"         uuid        NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_moderation_flags" PRIMARY KEY ("id")
      )
    `);
  });

  afterAll(async () => {
    await qr.release();
    await ds.destroy();
  });

  // ── Up migrations ──────────────────────────────────────────────────────────

  it('runs all migrations up without error', async () => {
    const ran = await ds.runMigrations({ transaction: 'each' });
    expect(ran.length).toBeGreaterThan(0);
  });

  it('CreateRefreshTokens: refresh_tokens table exists with expected columns', async () => {
    expect(await tableExists(qr, 'refresh_tokens')).toBe(true);
    expect(await columnExists(qr, 'refresh_tokens', 'token_hash')).toBe(true);
    expect(await columnExists(qr, 'refresh_tokens', 'user_id')).toBe(true);
    expect(await columnExists(qr, 'refresh_tokens', 'expires_at')).toBe(true);
  });

  it('AddSocialLinksToUser: social link columns exist on users', async () => {
    expect(await columnExists(qr, 'users', 'website_url')).toBe(true);
    expect(await columnExists(qr, 'users', 'twitter_handle')).toBe(true);
    expect(await columnExists(qr, 'users', 'instagram_handle')).toBe(true);
    expect(await columnExists(qr, 'users', 'other_link')).toBe(true);
  });

  it('CreateWalletChallenges: wallet_challenges table exists with expected columns', async () => {
    expect(await tableExists(qr, 'wallet_challenges')).toBe(true);
    expect(await columnExists(qr, 'wallet_challenges', 'stellar_address'  )).toBe(false); // camelCase stored as "stellarAddress"
    expect(await columnExists(qr, 'wallet_challenges', 'stellarAddress')).toBe(true);
    expect(await columnExists(qr, 'wallet_challenges', 'nonce')).toBe(true);
    expect(await columnExists(qr, 'wallet_challenges', 'expiresAt')).toBe(true);
  });

  it('CreateIdempotencyKeys: idempotency_keys table exists with expected columns', async () => {
    expect(await tableExists(qr, 'idempotency_keys')).toBe(true);
    expect(await columnExists(qr, 'idempotency_keys', 'key')).toBe(true);
    expect(await columnExists(qr, 'idempotency_keys', 'fingerprint')).toBe(true);
    expect(await columnExists(qr, 'idempotency_keys', 'expires_at')).toBe(true);
  });

  it('AddQueuedAtToModerationFlags: queued_at column exists on moderation_flags', async () => {
    expect(await columnExists(qr, 'moderation_flags', 'queued_at')).toBe(true);
  });

  it('CreateReferralTables: referral_codes and referral_redemptions tables exist', async () => {
    expect(await tableExists(qr, 'referral_codes')).toBe(true);
    expect(await tableExists(qr, 'referral_redemptions')).toBe(true);
    expect(await columnExists(qr, 'referral_codes', 'code')).toBe(true);
    expect(await columnExists(qr, 'referral_redemptions', 'redeemer_id')).toBe(true);
  });

  it('migrations table records all 6 migrations', async () => {
    const rows: { name: string }[] = await qr.query(
      `SELECT name FROM migrations ORDER BY timestamp ASC`,
    );
    expect(rows.length).toBe(6);
  });

  it('running migrations again is idempotent (no-op)', async () => {
    const ran = await ds.runMigrations({ transaction: 'each' });
    expect(ran.length).toBe(0);
  });

  // ── Down migrations (revert all in reverse order) ─────────────────────────

  it('reverts all migrations down without error', async () => {
    // Revert one at a time in reverse order
    for (let i = 0; i < 6; i++) {
      await ds.undoLastMigration({ transaction: true });
    }

    // All tracked migrations should be gone
    const rows: { name: string }[] = await qr.query(
      `SELECT name FROM migrations`,
    );
    expect(rows.length).toBe(0);
  });

  it('referral tables are dropped after revert', async () => {
    expect(await tableExists(qr, 'referral_codes')).toBe(false);
    expect(await tableExists(qr, 'referral_redemptions')).toBe(false);
  });

  it('wallet_challenges table is dropped after revert', async () => {
    expect(await tableExists(qr, 'wallet_challenges')).toBe(false);
  });

  it('refresh_tokens table is dropped after revert', async () => {
    expect(await tableExists(qr, 'refresh_tokens')).toBe(false);
  });
});
