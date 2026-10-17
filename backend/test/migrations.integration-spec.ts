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
import { spawnSync } from 'child_process';
import * as path from 'path';
import { DataSource, QueryRunner } from 'typeorm';

// ── Migration classes (same order as migration.datasource.ts) ────────────────
import { CreateRefreshTokens1700000000000 } from '../src/database/migrations/1700000000000-CreateRefreshTokens';
import { AddSocialLinksToUser1700000000000 } from '../src/social-link/1700000000000-AddSocialLinksToUser';
import { CreateWalletChallenges1711554834000 } from '../src/database/migrations/1711554834000-CreateWalletChallenges';
import { CreateIdempotencyKeys1711554835000 } from '../src/idempotency/1711554835000-CreateIdempotencyKeys';
import { AddQueuedAtToModerationFlags1745000000000 } from '../src/moderation/1745000000000-AddQueuedAtToModerationFlags';
import { CreateReferralTables1745000000000 } from '../src/referral/1745000000000-CreateReferralTables';
import { AddDigestColumnsToNotifications1745100000000 } from '../src/notifications/1745100000000-AddDigestColumnsToNotifications';
import { AddOnboardingStateToUsers1745200000000 } from '../src/users/1745200000000-AddOnboardingStateToUsers';
import { AddRoleToUsers1747000000000 } from '../src/users/1747000000000-AddRoleToUsers';
import { CreateSocialLinksTable1748000000000 } from '../src/social-link/1748000000000-CreateSocialLinksTable';
import { CreateCreatorOnchainMappings1749000000000 } from '../src/creators/1749000000000-CreateCreatorOnchainMappings';
import { CreateNotificationDurableState1750000000000 } from '../src/notifications/1750000000000-CreateNotificationDurableState';
import { CreateUserWalletLinks1751000000000 } from '../src/auth-module/1751000000000-CreateUserWalletLinks';
import { CreateSubscriptions1752000000000 } from '../src/subscriptions/1752000000000-CreateSubscriptions';

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
      AddDigestColumnsToNotifications1745100000000,
      AddOnboardingStateToUsers1745200000000,
      AddRoleToUsers1747000000000,
      CreateSocialLinksTable1748000000000,
      CreateCreatorOnchainMappings1749000000000,
      CreateNotificationDurableState1750000000000,
      CreateUserWalletLinks1751000000000,
      CreateSubscriptions1752000000000,
    ],
  });
}

async function tableExists(qr: QueryRunner, table: string): Promise<boolean> {
  const result: unknown = await qr.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1`,
    [table],
  );
  return Array.isArray(result) && result.length > 0;
}

async function columnExists(
  qr: QueryRunner,
  table: string,
  column: string,
): Promise<boolean> {
  const result: unknown = await qr.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column],
  );
  return Array.isArray(result) && result.length > 0;
}

async function columnIsNullable(
  qr: QueryRunner,
  table: string,
  column: string,
): Promise<boolean> {
  const result: unknown = await qr.query(
    `SELECT is_nullable FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column],
  );
  if (!Array.isArray(result) || result.length === 0) {
    throw new Error(`Column ${table}.${column} does not exist`);
  }
  return (result[0] as { is_nullable: string }).is_nullable === 'YES';
}

async function indexExists(
  qr: QueryRunner,
  table: string,
  indexName: string,
): Promise<boolean> {
  const result: unknown = await qr.query(
    `SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public' AND tablename = $1 AND indexname = $2`,
    [table, indexName],
  );
  return Array.isArray(result) && result.length > 0;
}

async function constraintExists(
  qr: QueryRunner,
  table: string,
  constraintName: string,
): Promise<boolean> {
  const result: unknown = await qr.query(
    `SELECT 1 FROM information_schema.table_constraints
     WHERE table_schema = 'public' AND table_name = $1 AND constraint_name = $2`,
    [table, constraintName],
  );
  return Array.isArray(result) && result.length > 0;
}

// ── run-migrations.ts script runner ───────────────────────────────────────────

const BACKEND_ROOT = path.resolve(__dirname, '..');

interface ScriptResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

/**
 * Spawns `scripts/run-migrations.ts` via ts-node against the same test
 * database configured for this spec, capturing exit status and output.
 */
function runMigrationsScript(args: string[] = []): ScriptResult {
  const result = spawnSync(
    'npx',
    [
      'ts-node',
      '-r',
      'tsconfig-paths/register',
      'scripts/run-migrations.ts',
      ...args,
    ],
    {
      cwd: BACKEND_ROOT,
      encoding: 'utf8',
      env: {
        ...process.env,
        DB_HOST: process.env.DB_HOST ?? 'localhost',
        DB_PORT: process.env.DB_PORT ?? '5432',
        DB_USER: process.env.DB_USER ?? 'myfans_ci',
        DB_PASSWORD: process.env.DB_PASSWORD ?? 'myfans_ci',
        DB_NAME: process.env.DB_NAME ?? 'myfans_test',
      },
    },
  );

  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
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
    expect(await columnExists(qr, 'users', 'use

/* … truncated 3862 chars — edit only what you need near the top … */
