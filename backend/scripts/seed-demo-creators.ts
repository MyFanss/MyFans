#!/usr/bin/env ts-node
/**
 * scripts/seed-demo-creators.ts
 *
 * Seeds the database with demo creator accounts and subscription plans for
 * local development and staging environments.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/seed-demo-creators.ts
 *   npx ts-node -r tsconfig-paths/register scripts/seed-demo-creators.ts --clean
 *
 * Flags:
 *   --clean   Remove all seeded demo rows before re-seeding (idempotent)
 *
 * Environment variables: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
 * (same as .env.example / .env.dev)
 *
 * Safety: refuses to run when NODE_ENV=production unless ALLOW_SEED=true is set.
 */
import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';

// ── Safety guard ─────────────────────────────────────────────────────────────
if (
  process.env.NODE_ENV === 'production' &&
  process.env.ALLOW_SEED !== 'true'
) {
  console.error(
    '[seed] Refusing to seed in production. Set ALLOW_SEED=true to override.',
  );
  process.exit(1);
}

const clean = process.argv.includes('--clean');

// ── DataSource (no entity classes needed — raw SQL for portability) ───────────
const ds = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'myfans',
  synchronize: false,
  logging: false,
});

// ── Demo data ─────────────────────────────────────────────────────────────────

interface DemoCreator {
  username: string;
  email: string;
  display_name: string;
  avatar_url: string;
  bio: string;
  subscription_price: string;
  currency: string;
  is_verified: boolean;
  plans: Array<{
    asset: string;
    amount: string;
    interval_days: number;
  }>;
}

const DEMO_CREATORS: DemoCreator[] = [
  {
    username: 'demo_alice',
    email: 'demo_alice@example.com',
    display_name: 'Alice (Demo)',
    avatar_url: 'https://i.pravatar.cc/150?u=demo_alice',
    bio: 'Demo creator — premium photography and travel content.',
    subscription_price: '10.000000',
    currency: 'XLM',
    is_verified: true,
    plans: [
      { asset: 'XLM', amount: '10', interval_days: 30 },
      { asset: 'USDC:GA7Z6G7T3LSSKDAWJH25C4JPLD4PQV4CEMM5S5E6LQD3VDF5W6G6F3K', amount: '5', interval_days: 30 },
    ],
  },
  {
    username: 'demo_bob',
    email: 'demo_bob@example.com',
    display_name: 'Bob (Demo)',
    avatar_url: 'https://i.pravatar.cc/150?u=demo_bob',
    bio: 'Demo creator — weekly tech tutorials and live coding sessions.',
    subscription_price: '25.000000',
    currency: 'XLM',
    is_verified: false,
    plans: [
      { asset: 'XLM', amount: '25', interval_days: 7 },
      { asset: 'XLM', amount: '80', interval_days: 30 },
    ],
  },
  {
    username: 'demo_carol',
    email: 'demo_carol@example.com',
    display_name: 'Carol (Demo)',
    avatar_url: 'https://i.pravatar.cc/150?u=demo_carol',
    bio: 'Demo creator — fitness coaching and nutrition guides.',
    subscription_price: '15.000000',
    currency: 'XLM',
    is_verified: true,
    plans: [
      { asset: 'XLM', amount: '15', interval_days: 30 },
      { asset: 'XLM', amount: '150', interval_days: 365 },
    ],
  },
];

const DEMO_PASSWORD_PLAIN = 'Demo1234!';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

async function upsertUser(
  ds: DataSource,
  creator: DemoCreator,
  passwordHash: string,
): Promise<string> {
  const result = await ds.query<{ id: string }[]>(
    `
    INSERT INTO users (
      id, email, username, password_hash, display_name, avatar_url,
      is_creator, role,
      email_notifications, push_notifications, marketing_emails,
      email_new_subscriber, email_subscription_renewal, email_new_comment,
      email_new_like, email_new_message, email_payout,
      push_new_subscriber, push_subscription_renewal, push_new_comment,
      push_new_like, push_new_message, push_payout,
      created_at, updated_at
    )
    VALUES (
      gen_random_uuid(), $1, $2, $3, $4, $5,
      true, 'user',
      true, false, false,
      true, true, true,
      false, true, true,
      true, true, true,
      true, true, false,
      NOW(), NOW()
    )
    ON CONFLICT (username) DO UPDATE SET
      email          = EXCLUDED.email,
      display_name   = EXCLUDED.display_name,
      avatar_url     = EXCLUDED.avatar_url,
      is_creator     = true,
      updated_at     = NOW()
    RETURNING id
    `,
    [
      creator.email,
      creator.username,
      passwordHash,
      creator.display_name,
      creator.avatar_url,
    ],
  );
  return result[0].id;
}

async function upsertCreatorProfile(
  ds: DataSource,
  userId: string,
  creator: DemoCreator,
): Promise<void> {
  await ds.query(
    `
    INSERT INTO creators (
      id, user_id, bio, subscription_price, currency, is_verified,
      followers_count, created_at, updated_at
    )
    VALUES (
      gen_random_uuid(), $1, $2, $3, $4, $5,
      0, NOW(), NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      bio                = EXCLUDED.bio,
      subscription_price = EXCLUDED.subscription_price,
      currency           = EXCLUDED.currency,
      is_verified        = EXCLUDED.is_verified,
      updated_at         = NOW()
    `,
    [
      userId,
      creator.bio,
      creator.subscription_price,
      creator.currency,
      creator.is_verified,
    ],
  );
}

async function cleanDemoRows(ds: DataSource): Promise<void> {
  const usernames = DEMO_CREATORS.map((c) => c.username);
  console.log('[seed] --clean: removing existing demo rows…');

  // Fetch user IDs first so we can cascade-clean creators
  const rows = await ds.query<{ id: string }[]>(
    `SELECT id FROM users WHERE username = ANY($1)`,
    [usernames],
  );
  const ids = rows.map((r) => r.id);

  if (ids.length > 0) {
    await ds.query(`DELETE FROM creators WHERE user_id = ANY($1)`, [ids]);
    await ds.query(`DELETE FROM users WHERE id = ANY($1)`, [ids]);
    console.log(`[seed] removed ${ids.length} demo user(s) and their creator profiles`);
  } else {
    console.log('[seed] no existing demo rows found');
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  await ds.initialize();
  console.log('[seed] connected to database');

  try {
    if (clean) {
      await cleanDemoRows(ds);
    }

    const passwordHash = await hashPassword(DEMO_PASSWORD_PLAIN);

    for (const creator of DEMO_CREATORS) {
      const userId = await upsertUser(ds, creator, passwordHash);
      await upsertCreatorProfile(ds, userId, creator);
      console.log(
        `[seed] upserted creator: ${creator.username} (userId=${userId}, plans=${creator.plans.length})`,
      );
    }

    console.log(
      `[seed] done — ${DEMO_CREATORS.length} demo creator(s) seeded. Password: "${DEMO_PASSWORD_PLAIN}"`,
    );
  } finally {
    await ds.destroy();
  }
}

main().catch((err) => {
  console.error('[seed] FAILED:', err);
  process.exit(1);
});
