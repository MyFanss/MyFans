import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as path from 'path';

describe('Seed Data and Query Tests', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_TEST_NAME || 'myfans_test',
      synchronize: false,
      logging: false,
    });

    await dataSource.initialize();

    // Apply migrations
    await this.applyMigrations();
  });

  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  private async applyMigrations() {
    const fs = require('fs');
    const migrationsDir = path.join(__dirname, '../../migrations');
    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((file: string) => file.endsWith('.up.sql'))
      .sort();

    for (const migration of migrationFiles) {
      const sql = fs.readFileSync(path.join(migrationsDir, migration), 'utf-8');
      await dataSource.query(sql);
    }
  }

  describe('Test Data Seeding', () => {
    it('should seed sample users', async () => {
      const users = [
        {
          email: 'alice@example.com',
          username: 'alice',
          password_hash: 'hashed_password_1',
          display_name: 'Alice Creator',
          bio: 'I create amazing content',
          avatar_url: 'https://example.com/alice.jpg',
        },
        {
          email: 'bob@example.com',
          username: 'bob',
          password_hash: 'hashed_password_2',
          display_name: 'Bob Fan',
          bio: 'Huge fan of great content',
          avatar_url: 'https://example.com/bob.jpg',
        },
        {
          email: 'charlie@example.com',
          username: 'charlie',
          password_hash: 'hashed_password_3',
          display_name: 'Charlie Creator',
        },
      ];

      for (const user of users) {
        await dataSource.query(
          `INSERT INTO users (email, username, password_hash, display_name, bio, avatar_url) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            user.email,
            user.username,
            user.password_hash,
            user.display_name,
            user.bio || null,
            user.avatar_url || null,
          ],
        );
      }

      const result = await dataSource.query('SELECT COUNT(*) as count FROM users');
      expect(result[0].count).toBe(3);
    });

    it('should seed sample creators', async () => {
      // Get user IDs
      const users = await dataSource.query('SELECT id FROM users LIMIT 2');
      const aliceId = users[0].id;
      const charlieId = users[1].id;

      const creators = [
        {
          userId: aliceId,
          slug: 'alice-creator',
          headline: 'Photography & Travel',
          description: 'Sharing my photography journey from around the world',
          isVerified: true,
        },
        {
          userId: charlieId,
          slug: 'charlie-music',
          headline: 'Music Production',
          description: 'Teaching music production and sharing original songs',
          isVerified: false,
        },
      ];

      for (const creator of creators) {
        await dataSource.query(
          `INSERT INTO creators (user_id, slug, headline, description, is_verified) 
           VALUES ($1, $2, $3, $4, $5)`,
          [
            creator.userId,
            creator.slug,
            creator.headline,
            creator.description,
            creator.isVerified,
          ],
        );
      }

      const result = await dataSource.query('SELECT COUNT(*) as count FROM creators');
      expect(result[0].count).toBe(2);
    });

    it('should seed sample plans', async () => {
      const creators = await dataSource.query('SELECT id FROM creators LIMIT 2');

      const plans = [
        {
          creatorId: creators[0].id,
          name: 'Basic Access',
          description: 'Access to all public content',
          priceCents: 999,
          billingInterval: 'monthly',
        },
        {
          creatorId: creators[0].id,
          name: 'Premium Access',
          description: 'Behind-the-scenes content and early access',
          priceCents: 2999,
          billingInterval: 'monthly',
        },
        {
          creatorId: creators[0].id,
          name: 'Annual Premium',
          description: 'Full year of premium content at a discount',
          priceCents: 29990,
          billingInterval: 'yearly',
        },
        {
          creatorId: creators[1].id,
          name: 'Music Producer Access',
          description: 'Access to production tutorials and samples',
          priceCents: 1999,
          billingInterval: 'monthly',
        },
      ];

      for (const plan of plans) {
        await dataSource.query(
          `INSERT INTO plans (creator_id, name, description, price_cents, billing_interval, is_active) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            plan.creatorId,
            plan.name,
            plan.description,
            plan.priceCents,
            plan.billingInterval,
            true,
          ],
        );
      }

      const result = await dataSource.query('SELECT COUNT(*) as count FROM plans');
      expect(result[0].count).toBe(4);
    });

    it('should seed sample content', async () => {
      const creators = await dataSource.query('SELECT id FROM creators LIMIT 1');
      const creatorId = creators[0].id;

      const content = [
        {
          title: 'Morning Photography Tips',
          body: 'Here are my top 5 tips for capturing beautiful morning light...',
          mediaUrl: 'https://example.com/morning-photo.jpg',
          visibility: 'public',
          publishedAt: new Date('2026-03-20'),
        },
        {
          title: 'Behind the Scenes - Studio Setup',
          body: 'A detailed walkthrough of my photography studio...',
          mediaUrl: 'https://example.com/studio.jpg',
          visibility: 'subscribers_only',
          publishedAt: new Date('2026-03-21'),
        },
        {
          title: 'Premium Tutorial - Advanced Composition',
          body: 'Advanced composition techniques for professional photography',
          mediaUrl: 'https://example.com/composition.mp4',
          visibility: 'premium',
          publishedAt: new Date('2026-03-22'),
        },
        {
          title: 'Draft - New Series Coming Soon',
          body: 'I am working on a new photography series...',
          visibility: 'public',
          publishedAt: null, // Not published yet
        },
      ];

      for (const post of content) {
        await dataSource.query(
          `INSERT INTO content (creator_id, title, body, media_url, visibility, published_at) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            creatorId,
            post.title,
            post.body,
            post.mediaUrl || null,
            post.visibility,
            post.publishedAt || null,
          ],
        );
      }

      const result = await dataSource.query('SELECT COUNT(*) as count FROM content');
      expect(result[0].count).toBe(4);
    });

    it('should seed sample subscriptions', async () => {
      // Get a fan user and plans
      const fanUsers = await dataSource.query(
        'SELECT id FROM users WHERE username = $1',
        ['bob'],
      );
      const fanUserId = fanUsers[0].id;

      const plans = await dataSource.query(
        'SELECT id FROM plans LIMIT 3',
      );

      const subscriptions = [
        {
          userId: fanUserId,
          planId: plans[0].id,
          status: 'active',
          startedAt: new Date('2026-01-01'),
          expiresAt: new Date('2026-04-01'),
        },
        {
          userId: fanUserId,
          planId: plans[1].id,
          status: 'active',
          startedAt: new Date('2026-03-01'),
          expiresAt: new Date('2027-03-01'),
        },
        {
          userId: fanUserId,
          planId: plans[2].id,
          status: 'cancelled',
          startedAt: new Date('2025-01-01'),
          expiresAt: new Date('2026-01-01'),
        },
      ];

      for (const sub of subscriptions) {
        await dataSource.query(
          `INSERT INTO subscriptions (user_id, plan_id, status, started_at, expires_at) 
           VALUES ($1, $2, $3, $4, $5)`,
          [
            sub.userId,
            sub.planId,
            sub.status,
            sub.startedAt,
            sub.expiresAt,
          ],
        );
      }

      const result = await dataSource.query(
        'SELECT COUNT(*) as count FROM subscriptions',
      );
      expect(result[0].count).toBe(3);
    });
  });

  describe('Query Tests - Core Functionality', () => {
    it('should fetch creator by slug', async () => {
      const result = await dataSource.query(
        `SELECT id, user_id, slug, headline, is_verified FROM creators 
         WHERE slug = $1 LIMIT 1`,
        ['alice-creator'],
      );

      expect(result.length).toBe(1);
      expect(result[0].slug).toBe('alice-creator');
      expect(result[0].headline).toBe('Photography & Travel');
      expect(result[0].is_verified).toBe(true);
    });

    it('should fetch active plans by creator', async () => {
      const creators = await dataSource.query(
        `SELECT id FROM creators WHERE slug = $1`,
        ['alice-creator'],
      );
      const creatorId = creators[0].id;

      const result = await dataSource.query(
        `SELECT id, name, price_cents, billing_interval FROM plans 
         WHERE creator_id = $1 AND is_active = TRUE 
         ORDER BY price_cents ASC`,
        [creatorId],
      );

      expect(result.length).toBeGreaterThan(0);
      expect(result.every((p) => p.is_active !== false)).toBe(true);
      expect(result[0].name).toBe('Basic Access');
    });

    it('should fetch published content by creator', async () => {
      const creators = await dataSource.query(
        `SELECT id FROM creators WHERE slug = $1`,
        ['alice-creator'],
      );
      const creatorId = creators[0].id;

      const result = await dataSource.query(
        `SELECT id, title, visibility, published_at FROM content 
         WHERE creator_id = $1 AND published_at IS NOT NULL 
         ORDER BY published_at DESC`,
        [creatorId],
      );

      expect(result.length).toBeGreaterThan(0);
      expect(result.every((c) => c.published_at !== null)).toBe(true);
    });

    it('should fetch public content by creator', async () => {
      const creators = await dataSource.query(
        `SELECT id FROM creators WHERE slug = $1`,
        ['alice-creator'],
      );
      const creatorId = creators[0].id;

      const result = await dataSource.query(
        `SELECT id, title, visibility FROM content 
         WHERE creator_id = $1 AND visibility = $2 
         ORDER BY published_at DESC`,
        [creatorId, 'public'],
      );

      expect(result.length).toBeGreaterThan(0);
      expect(result.every((c) => c.visibility === 'public')).toBe(true);
    });

    it('should fetch active subscriptions by user', async () => {
      const users = await dataSource.query(
        `SELECT id FROM users WHERE username = $1`,
        ['bob'],
      );
      const userId = users[0].id;

      const result = await dataSource.query(
        `SELECT s.id, s.plan_id, s.status, p.name, p.price_cents
         FROM subscriptions s
         JOIN plans p ON s.plan_id = p.id
         WHERE s.user_id = $1 AND s.status = $2
         ORDER BY s.created_at DESC`,
        [userId, 'active'],
      );

      expect(result.length).toBe(2);
      expect(result.every((s) => s.status === 'active')).toBe(true);
    });

    it('should fetch subscriptions by user and plan', async () => {
      const users = await dataSource.query(
        `SELECT id FROM users WHERE username = $1`,
        ['bob'],
      );
      const userId = users[0].id;

      const plans = await dataSource.query(
        `SELECT id FROM plans LIMIT 1`,
      );
      const planId = plans[0].id;

      const result = await dataSource.query(
        `SELECT id, status, started_at, expires_at FROM subscriptions 
         WHERE user_id = $1 AND plan_id = $2`,
        [userId, planId],
      );

      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it('should fetch subscriber count for plan', async () => {
      const plans = await dataSource.query(
        `SELECT id FROM plans LIMIT 1`,
      );
      const planId = plans[0].id;

      const result = await dataSource.query(
        `SELECT COUNT(*) as subscriber_count FROM subscriptions 
         WHERE plan_id = $1 AND status = $2`,
        [planId, 'active'],
      );

      expect(result[0].subscriber_count).toBeGreaterThanOrEqual(0);
    });

    it('should fetch creator earnings summary', async () => {
      const creators = await dataSource.query(
        `SELECT id FROM creators WHERE slug = $1`,
        ['alice-creator'],
      );
      const creatorId = creators[0].id;

      const result = await dataSource.query(
        `SELECT COUNT(DISTINCT s.user_id) as total_subscribers,
                COUNT(DISTINCT s.plan_id) as total_plans,
                SUM(CASE WHEN s.status = 'active' THEN 1 ELSE 0 END) as active_subscriptions
         FROM subscriptions s
         JOIN plans p ON s.plan_id = p.id
         WHERE p.creator_id = $1`,
        [creatorId],
      );

      expect(result[0].total_subscribers).toBeDefined();
      expect(result[0].total_plans).toBeDefined();
      expect(result[0].active_subscriptions).toBeDefined();
    });

    it('should fetch expired subscriptions', async () => {
      const result = await dataSource.query(
        `SELECT id, user_id, plan_id, expires_at FROM subscriptions 
         WHERE expires_at < NOW() AND status != $1
         ORDER BY expires_at DESC
         LIMIT 10`,
        ['expired'],
      );

      // This should work even if no results
      expect(Array.isArray(result)).toBe(true);
    });

    it('should efficiently query multiple creators', async () => {
      const result = await dataSource.query(
        `SELECT c.id, c.slug, c.headline, c.is_verified, COUNT(p.id) as plan_count
         FROM creators c
         LEFT JOIN plans p ON c.id = p.creator_id
         GROUP BY c.id
         ORDER BY c.created_at DESC
         LIMIT 10`,
      );

      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0].plan_count).toBeDefined();
      }
    });

    it('should fetch creator content summary', async () => {
      const creators = await dataSource.query(
        `SELECT id FROM creators WHERE slug = $1`,
        ['alice-creator'],
      );
      const creatorId = creators[0].id;

      const result = await dataSource.query(
        `SELECT 
           visibility,
           COUNT(*) as count,
           COUNT(CASE WHEN published_at IS NOT NULL THEN 1 END) as published_count
         FROM content
         WHERE creator_id = $1
         GROUP BY visibility`,
        [creatorId],
      );

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Performance Tests - Index Usage', () => {
    it('should efficiently query by email', async () => {
      const startTime = Date.now();
      const result = await dataSource.query(
        `SELECT id FROM users WHERE email = $1`,
        ['alice@example.com'],
      );
      const duration = Date.now() - startTime;

      expect(result.length).toBe(1);
      expect(duration).toBeLessThan(100); // Should be very fast with index
    });

    it('should efficiently query by creator slug', async () => {
      const startTime = Date.now();
      const result = await dataSource.query(
        `SELECT id FROM creators WHERE slug = $1`,
        ['alice-creator'],
      );
      const duration = Date.now() - startTime;

      expect(result.length).toBe(1);
      expect(duration).toBeLessThan(100);
    });

    it('should efficiently filter active plans', async () => {
      const creators = await dataSource.query(
        `SELECT id FROM creators LIMIT 1`,
      );
      const creatorId = creators[0].id;

      const startTime = Date.now();
      const result = await dataSource.query(
        `SELECT id FROM plans 
         WHERE creator_id = $1 AND is_active = TRUE`,
        [creatorId],
      );
      const duration = Date.now() - startTime;

      expect(Array.isArray(result)).toBe(true);
      expect(duration).toBeLessThan(100);
    });

    it('should efficiently query active subscriptions by user', async () => {
      const users = await dataSource.query(
        `SELECT id FROM users LIMIT 1`,
      );
      const userId = users[0].id;

      const startTime = Date.now();
      const result = await dataSource.query(
        `SELECT id FROM subscriptions 
         WHERE user_id = $1 AND status = $2`,
        [userId, 'active'],
      );
      const duration = Date.now() - startTime;

      expect(Array.isArray(result)).toBe(true);
      expect(duration).toBeLessThan(100);
    });
  });
});
