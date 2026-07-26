#!/usr/bin/env ts-node
/**
 * scripts/seed-demo-expanded.ts
 *
 * Expands the base demo dataset (scripts/seed-demo-creators.ts) with fan
 * accounts, posts, subscriptions and a conversation so the frontend has
 * enough entities to demo feeds, gated content, and messaging — not just
 * empty creator profiles.
 *
 * This is additive and separate from seed-demo-creators.ts: run that
 * script FIRST, then run this one against the same database.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/seed-demo-creators.ts
 *   npx ts-node -r tsconfig-paths/register scripts/seed-demo-expanded.ts
 *   npx ts-node -r tsconfig-paths/register scripts/seed-demo-expanded.ts --clean
 *
 * Flags:
 *   --clean   Remove previously seeded expanded rows before re-seeding (idempotent)
 *
 * Environment variables: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
 * (same as .env.example / .env.dev)
 *
 * Safety: refuses to run when NODE_ENV=production unless ALLOW_SEED=true is set.
 *
 * NOTE: this script has not been executed against a live database as part
 * of this change (per request: no installs/build/test). Column names were
 * matched against the current entities (Post, Conversation, Message,
 * SubscriptionIndexEntity) — verify against a live schema before relying
 * on it in CI.
 */
import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';

if (
  process.env.NODE_ENV === 'production' &&
  process.env.ALLOW_SEED !== 'true'
) {
  console.error(
    '[seed-expanded] Refusing to seed in production. Set ALLOW_SEED=true to override.',
  );
  process.exit(1);
}

const clean = process.argv.includes('--clean');

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

const CREATOR_USERNAMES = ['demo_alice', 'demo_bob', 'demo_carol'];

const DEMO_FANS = [
  { username: 'demo_fan_dave', email: 'demo_fan_dave@example.com', display_name: 'Dave (Demo Fan)' },
  { username: 'demo_fan_erin', email: 'demo_fan_erin@example.com', display_name: 'Erin (Demo Fan)' },
];

const DEMO_PASSWORD_PLAIN = 'Demo1234!';

// Fake Stellar-shaped G-address for demo/index rows only — not a real account.
function fakeGAddress(seed: string): string {
  const base = seed.toUpperCase().replace(/[^A-Z0-9]/g, '').padEnd(55, 'X');
  return `G${base.slice(0, 55)}`;
}

async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

async function upsertFan(ds: DataSource, fan: (typeof DEMO_FANS)[number], passwordHash: string): Promise<string> {
  const result = await ds.query<{ id: string }[]>(
    `
    INSERT INTO users (
      id, email, username, password_hash, display_name, is_creator, role,
      email_notifications, push_notifications, marketing_emails,
      email_new_subscriber, email_subscription_renewal, email_new_comment,
      email_new_like, email_new_message, email_payout,
      push_new_subscriber, push_subscription_renewal, push_new_comment,
      push_new_like, push_new_message, push_payout,
      created_at, updated_at
    )
    VALUES (
      gen_random_uuid(), $1, $2, $3, $4, false, 'user',
      true, false, false,
      true, true, true,
      false, true, true,
      true, true, true,
      true, true, false,
      NOW(), NOW()
    )
    ON CONFLICT (username) DO UPDATE SET
      email = EXCLUDED.email,
      display_name = EXCLUDED.display_name,
      updated_at = NOW()
    RETURNING id
    `,
    [fan.email, fan.username, passwordHash, fan.display_name],
  );
  return result[0].id;
}

async function getUserIdByUsername(ds: DataSource, username: string): Promise<string | undefined> {
  const rows = await ds.query<{ id: string }[]>(`SELECT id FROM users WHERE username = $1`, [username]);
  return rows[0]?.id;
}

async function seedPosts(ds: DataSource, creatorUserId: string, username: string): Promise<void> {
  const posts = [
    { title: `${username}'s welcome post`, content: 'Welcome to my page! Free preview content.', isPublished: true, isPremium: false },
    { title: `${username}'s premium drop`, content: 'Exclusive subscriber-only content.', isPublished: true, isPremium: true },
  ];

  for (const post of posts) {
    await ds.query(
      `
      INSERT INTO posts (id, title, content, "authorId", "isPublished", "isPremium", "likesCount", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 0, NOW(), NOW())
      ON CONFLICT DO NOTHING
      `,
      [post.title, post.content, creatorUserId, post.isPublished, post.isPremium],
    );
  }
}

async function seedSubscription(ds: DataSource, fanUsername: string, creatorUsername: string): Promise<void> {
  const fanAddr = fakeGAddress(fanUsername);
  const creatorAddr = fakeGAddress(creatorUsername);
  const expiry = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

  await ds.query(
    `
    INSERT INTO subscription_index (
      id, fan, creator, "planId", "expiryUnix", created_at, status,
      "ledgerSeq", "eventIndex", "eventType", "indexedAt", "updatedAt"
    )
    VALUES (
      gen_random_uuid(), $1, $2, 1, $3, NOW(), 'active',
      1, 0, 'manual', NOW(), NOW()
    )
    ON CONFLICT ("ledgerSeq", "eventIndex") DO NOTHING
    `,
    [fanAddr, creatorAddr, expiry],
  );
}

async function seedConversation(ds: DataSource, fanId: string, creatorId: string, creatorUsername: string): Promise<void> {
  const convRows = await ds.query<{ id: string }[]>(
    `
    INSERT INTO conversations (id, "participant1Id", "participant2Id", "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), $1, $2, NOW(), NOW())
    RETURNING id
    `,
    [fanId, creatorId],
  );
  const conversationId = convRows[0].id;

  await ds.query(
    `
    INSERT INTO messages (id, "conversationId", "senderId", content, "isRead", "createdAt")
    VALUES (gen_random_uuid(), $1, $2, $3, false, NOW())
    `,
    [conversationId, fanId, `Hey ${creatorUsername}, loving your content!`],
  );
}

async function cleanExpandedRows(ds: DataSource): Promise<void> {
  console.log('[seed-expanded] --clean: removing previously expanded demo rows…');
  const fanUsernames = DEMO_FANS.map((f) => f.username);
  const rows = await ds.query<{ id: string }[]>(`SELECT id FROM users WHERE username = ANY($1)`, [fanUsernames]);
  const fanIds = rows.map((r) => r.id);

  if (fanIds.length > 0) {
    await ds.query(`DELETE FROM messages WHERE "senderId" = ANY($1)`, [fanIds]);
    await ds.query(`DELETE FROM conversations WHERE "participant1Id" = ANY($1) OR "participant2Id" = ANY($1)`, [fanIds]);
    await ds.query(`DELETE FROM users WHERE id = ANY($1)`, [fanIds]);
  }

  await ds.query(
    `DELETE FROM subscription_index WHERE fan = ANY($1)`,
    [DEMO_FANS.map((f) => fakeGAddress(f.username))],
  );
}

async function main(): Promise<void> {
  await ds.initialize();
  console.log('[seed-expanded] connected to database');

  try {
    if (clean) {
      await cleanExpandedRows(ds);
    }

    const creatorIds: Record<string, string> = {};
    for (const username of CREATOR_USERNAMES) {
      const id = await getUserIdByUsername(ds, username);
      if (!id) {
        console.warn(`[seed-expanded] creator "${username}" not found — run seed-demo-creators.ts first. Skipping.`);
        continue;
      }
      creatorIds[username] = id;
      await seedPosts(ds, id, username);
      console.log(`[seed-expanded] seeded posts for ${username}`);
    }

    const passwordHash = await hashPassword(DEMO_PASSWORD_PLAIN);
    const fanIds: string[] = [];
    for (const fan of DEMO_FANS) {
      const id = await upsertFan(ds, fan, passwordHash);
      fanIds.push(id);
      console.log(`[seed-expanded] upserted fan: ${fan.username} (userId=${id})`);
    }

    for (const [i, username] of CREATOR_USERNAMES.entries()) {
      const creatorId = creatorIds[username];
      const fanId = fanIds[i % fanIds.length];
      if (!creatorId || !fanId) continue;

      await seedSubscription(ds, DEMO_FANS[i % DEMO_FANS.length].username, username);
      await seedConversation(ds, fanId, creatorId, username);
      console.log(`[seed-expanded] linked fan -> ${username} (subscription + conversation)`);
    }

    console.log('[seed-expanded] done — posts, subscriptions and conversations seeded.');
  } finally {
    await ds.destroy();
  }
}

main().catch((err) => {
  console.error('[seed-expanded] FAILED:', err);
  process.exit(1);
});
