#!/usr/bin/env ts-node
/**
 * scripts/seed-demo-creators.ts
 *
 * Seeds the database with demo creator accounts, subscription plans and
 * content for local development and staging environments.
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
 * Demo rows are tagged with the `demo_seed` marker column so `--clean` only
 * ever removes demo data and never touches real rows.
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

// Marker value written to the `demo_seed` column of every demo row. `--clean`
// deletes only rows carrying this marker, so real data is never wiped.
const DEMO_MARKER = 'demo-expanded-v1';

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

interface DemoPlan {
  asset: string;
  amount: string;
  interval_days: number;
}

interface DemoContent {
  title: string;
  body: string;
  visibility: 'public' | 'subscribers';
}

interface DemoCreator {
  username: string;
  email: string;
  display_name: string;
  avatar_url: string;
  bio: string;
  subscription_price: string;
  currency: string;
  is_verified: boolean;
  plans: DemoPlan[];
  content: DemoContent[];
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
    content: [
      {
        title: 'Welcome to Alice\'s studio',
        body: 'A short intro to the photography and travel content you can expect.',
        visibility: 'public',
      },
      {
        title: 'Behind the scenes: Iceland',
        body: 'Subscriber-only breakdown of the gear and settings used on location.',
        visibility: 'subscribers',
      },
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
    content: [
      {
        title: 'TypeScript tips for 2024',
        body: 'Five small patterns that make large codebases easier to maintain.',
        visibility: 'public',
      },
      {
        title: 'Live coding: building a payments flow',
        body: 'Full walkthrough of the demo payments flow, subscriber-only.',
        visibility: 'subscribers',
      },
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
    content: [
      {
        title: 'Start here: 4-week beginner plan',
        body: 'A gentle introduction to the training and nutrition programme.',
        visibility: 'public',
      },
      {
        title: 'Meal prep for busy weeks',
        body: 'Subscriber-only recipes and prep schedule.',
        visibility: 'subscribers',
      },
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
      demo_seed,
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
      $6,
      NOW(), NOW()
    )
    ON CONFLICT (username) DO UPDATE SET
      email          = EXCLUDED.email,
      display_name   = EXCLUDED.display_name,
      avatar_url     = EXCLUDED.avatar_url,
      is_creator     = true,
      demo_seed      = EXCLUDED.demo_seed,
      updated_at     = NOW()
    RETURNING id
    `,
    [
      creator.email,
      creator.username,
      passwordHash,
      creator.display_name,
      creator.avatar_url,
      DEMO_MARKER,
    ],
  );
  return result[0].id;
}

async function upsertCreatorProfile(
  ds: DataSource,
  userId: string,
  creator: DemoCreator,
): Promise<string> {
  const result = await ds.query<{ id: string }[]>(
    `
    INSERT INTO creators (
      id, user_id, bio, subscription_price, currency, is_verified,
      followers_count, demo_seed, created_at, updated_at
    )
    VALUES (
      gen_random_uuid(), $1, $2, $3, $4, $5,
      0, $6, NOW(), NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      bio                = EXCLUDED.bio,
      subscription_price = EXCLUDED.subscription_price,
      currency           = EXCLUDED.currency,
      is_verified        = EXCLUDED.is_verified,
      demo_seed          = EXCLUDED.demo_seed,
      updated_at         = NOW()
    RETURNING id
    `,
    [
      userId,
      creator.bio,
      creator.subscription_price,
      creator.currency,
      creator.is_verified,
      DEMO_MARKER,
    ],
  );
  return result[0].id;
}

async function upsertPlans(
  ds: DataSource,
  creatorId: string,
  creator: DemoCreator,
): Promise<void> {
  for (const plan of creator.plans) {
    await ds.query(
      `
      INSERT INTO subscription_plans (
        id, creator_id, asset, amount, interval_days, demo_seed,
        created_at, updated_at
      )
      VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5,
        NOW(), NOW()
      )
      ON CONFLICT (creator_id, asset, interval_days) DO UPDATE SET
        amount     = EXCLUDED.amount,
        demo_seed  = EXCLUDED.demo_seed,
        updated_at = NOW()
      `,
      [creatorId, plan.asset, plan.amount, plan.interval_days, DEMO_MARKER],
    );
  }
}

async function upsertContent(
  ds: DataSource,
  creatorId: string,
  creator: DemoCreator,
): Promise<void> {
  for (const post of creator.content) {
    await ds.query(
      `
      INSERT INTO posts (
        id, creator_id, title, body, visibility, demo_seed,
        created_at, updated_at
      )
      VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5,
        NOW(), NOW()
      )
      ON CONFLICT (creator_id, title) DO UPDATE SET
        body       = EXCLUDED.body,
        visibility = EXCLUDED.visibility,
        demo_seed  = EXCLUDED.demo_seed,
        updated_at = NOW()
      `,
      [creatorId, post.title, post.body, post.visibility, DEMO_MARKER],
    );
  }
}

async function cleanDemoRows(ds: DataSource): Promise<void> {
  console.log('[seed] --clean: removing existing demo rows…');

  // Only rows tagged with the demo marker are removed — real data is untouched.
  const posts = await ds.query(`DELETE FROM posts WHERE demo_seed = $1`, [
    DEMO_MARKER,
  ]);
  const plans = await ds.query(
    `DELETE FROM subscription_plans WHERE demo_seed = $1`,
    [DEMO_MARKER],
  );
  const creators = await ds.query(
    `DELETE FROM creators WHERE demo_seed = $1`,
    [DEMO_MARKER],
  );
  const users = await ds.query(`DELETE FROM users WHERE demo_seed = $1`, [
    DEMO_MARKER,
  ]);

  console.log(
    `[seed] removed demo rows — users=${users.length}, creators=${creators.length}, plans=${plans.length}, posts=${posts.length}`,
  );
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
      const creatorId = await upsertCreatorProfile(ds, userId, creator);
      await upsertPlans(ds, creatorId, creator);
      await upsertContent(ds, creatorId, creator);
      console.log(
        `[seed] upserted creator: ${creator.username} (userId=${userId}, creatorId=${creatorId}, plans=${creator.plans.length}, posts=${creator.content.length})`,
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
