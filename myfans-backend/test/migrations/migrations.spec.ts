import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as path from 'path';
import { MigrationExecutor } from './migration.executor';

describe('Database Migrations - Core Schema', () => {
  let dataSource: DataSource;
  let migrationExecutor: MigrationExecutor;

  /**
   * Setup: Create a test database connection
   */
  beforeAll(async () => {
    // Use SQLite in-memory for tests or PostgreSQL test DB connection
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
    migrationExecutor = new MigrationExecutor(
      dataSource,
      path.join(__dirname, '../../migrations'),
    );

    // Ensure clean state by rolling back if migrations were already applied
    try {
      const tables = await migrationExecutor.getTableNames();
      if (tables.length > 0) {
        await migrationExecutor.migrateDown();
      }
    } catch (err) {
      // Table might not exist yet, continue
    }
  });

  /**
   * Cleanup: Destroy data source connection
   */
  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  describe('Migration: 001_create_users', () => {
    it('should create users table with correct schema', async () => {
      // Apply first migration
      const migration = migrationExecutor.getMigrationFiles('up')[0];
      const sql = require('fs').readFileSync(
        path.join(__dirname, '../../migrations', migration),
        'utf-8',
      );
      await dataSource.query(sql);

      // Verify table exists
      const tables = await migrationExecutor.getTableNames();
      expect(tables).toContain('users');

      // Verify columns exist
      const columns = await migrationExecutor.getTableColumns('users');
      expect(columns).toContain('id');
      expect(columns).toContain('email');
      expect(columns).toContain('username');
      expect(columns).toContain('password_hash');
      expect(columns).toContain('display_name');
      expect(columns).toContain('bio');
      expect(columns).toContain('avatar_url');
      expect(columns).toContain('is_active');
      expect(columns).toContain('created_at');
      expect(columns).toContain('updated_at');
    });

    it('should create required indexes on users table', async () => {
      const indexes = await migrationExecutor.getTableIndexes('users');
      const indexNames = indexes.map((idx) => idx.indexname);

      expect(indexNames).toContain('idx_users_email');
      expect(indexNames).toContain('idx_users_username');
      expect(indexNames).toContain('idx_users_created_at');
    });

    it('should enforce unique constraints on email and username', async () => {
      // Insert first user
      await dataSource.query(
        `INSERT INTO users (email, username, password_hash, is_active) 
         VALUES ($1, $2, $3, $4)`,
        ['test@example.com', 'testuser', 'hash123', true],
      );

      // Try to insert duplicate email - should fail
      await expect(
        dataSource.query(
          `INSERT INTO users (email, username, password_hash, is_active) 
           VALUES ($1, $2, $3, $4)`,
          ['test@example.com', 'anotheruser', 'hash456', true],
        ),
      ).rejects.toThrow();

      // Try to insert duplicate username - should fail
      await expect(
        dataSource.query(
          `INSERT INTO users (email, username, password_hash, is_active) 
           VALUES ($1, $2, $3, $4)`,
          ['another@example.com', 'testuser', 'hash789', true],
        ),
      ).rejects.toThrow();
    });

    it('should rollback users table creation', async () => {
      const downMigration = migrationExecutor.getMigrationFiles('down')[0];
      const sql = require('fs').readFileSync(
        path.join(__dirname, '../../migrations', downMigration),
        'utf-8',
      );
      await dataSource.query(sql);

      // Verify table no longer exists
      const tables = await migrationExecutor.getTableNames();
      expect(tables).not.toContain('users');
    });
  });

  describe('Migration: 002_create_creators', () => {
    beforeEach(async () => {
      // Apply users migration first (dependency)
      const userMigration = migrationExecutor.getMigrationFiles('up')[0];
      const userSql = require('fs').readFileSync(
        path.join(__dirname, '../../migrations', userMigration),
        'utf-8',
      );
      await dataSource.query(userSql);

      // Apply creators migration
      const creatorMigration = migrationExecutor.getMigrationFiles('up')[1];
      const creatorSql = require('fs').readFileSync(
        path.join(__dirname, '../../migrations', creatorMigration),
        'utf-8',
      );
      await dataSource.query(creatorSql);
    });

    it('should create creators table with correct schema', async () => {
      const tables = await migrationExecutor.getTableNames();
      expect(tables).toContain('creators');

      const columns = await migrationExecutor.getTableColumns('creators');
      expect(columns).toContain('id');
      expect(columns).toContain('user_id');
      expect(columns).toContain('slug');
      expect(columns).toContain('headline');
      expect(columns).toContain('description');
      expect(columns).toContain('is_verified');
      expect(columns).toContain('created_at');
      expect(columns).toContain('updated_at');
    });

    it('should create required indexes on creators table', async () => {
      const indexes = await migrationExecutor.getTableIndexes('creators');
      const indexNames = indexes.map((idx) => idx.indexname);

      expect(indexNames).toContain('idx_creators_user_id');
      expect(indexNames).toContain('idx_creators_slug');
      expect(indexNames).toContain('idx_creators_is_verified');
    });

    it('should enforce foreign key constraint on user_id', async () => {
      // Try to insert creator with non-existent user_id
      await expect(
        dataSource.query(
          `INSERT INTO creators (user_id, slug) 
           VALUES ($1, $2)`,
          ['00000000-0000-0000-0000-000000000000', 'test-creator'],
        ),
      ).rejects.toThrow();
    });

    it('should enforce unique constraint on slug', async () => {
      // Insert a user first
      const userResult = await dataSource.query(
        `INSERT INTO users (email, username, password_hash) 
         VALUES ($1, $2, $3) RETURNING id`,
        ['creator@example.com', 'creatoruser', 'hash123'],
      );
      const userId = userResult[0].id;

      // Insert first creator
      await dataSource.query(
        `INSERT INTO creators (user_id, slug) 
         VALUES ($1, $2)`,
        [userId, 'unique-slug'],
      );

      // Try to insert another creator with same slug - should fail
      const userResult2 = await dataSource.query(
        `INSERT INTO users (email, username, password_hash) 
         VALUES ($1, $2, $3) RETURNING id`,
        ['creator2@example.com', 'creatoruser2', 'hash456'],
      );
      const userId2 = userResult2[0].id;

      await expect(
        dataSource.query(
          `INSERT INTO creators (user_id, slug) 
           VALUES ($1, $2)`,
          [userId2, 'unique-slug'],
        ),
      ).rejects.toThrow();
    });

    it('should cascade delete creators when user is deleted', async () => {
      // Insert a user
      const userResult = await dataSource.query(
        `INSERT INTO users (email, username, password_hash) 
         VALUES ($1, $2, $3) RETURNING id`,
        ['user-to-delete@example.com', 'deletableuser', 'hash123'],
      );
      const userId = userResult[0].id;

      // Insert creator for that user
      await dataSource.query(
        `INSERT INTO creators (user_id, slug) 
         VALUES ($1, $2)`,
        [userId, 'will-be-deleted'],
      );

      // Verify creator exists
      let creators = await dataSource.query(
        `SELECT * FROM creators WHERE user_id = $1`,
        [userId],
      );
      expect(creators.length).toBe(1);

      // Delete user
      await dataSource.query(`DELETE FROM users WHERE id = $1`, [userId]);

      // Verify creator was cascade deleted
      creators = await dataSource.query(
        `SELECT * FROM creators WHERE user_id = $1`,
        [userId],
      );
      expect(creators.length).toBe(0);
    });

    it('should enforce unique constraint on user_id', async () => {
      // Insert a user
      const userResult = await dataSource.query(
        `INSERT INTO users (email, username, password_hash) 
         VALUES ($1, $2, $3) RETURNING id`,
        ['unique-user@example.com', 'uniqueuser', 'hash123'],
      );
      const userId = userResult[0].id;

      // Insert first creator
      await dataSource.query(
        `INSERT INTO creators (user_id, slug) 
         VALUES ($1, $2)`,
        [userId, 'first-creator'],
      );

      // Try to insert another creator for same user - should fail
      await expect(
        dataSource.query(
          `INSERT INTO creators (user_id, slug) 
           VALUES ($1, $2)`,
          [userId, 'second-creator'],
        ),
      ).rejects.toThrow();
    });
  });

  describe('Migration: 003_create_plans', () => {
    beforeEach(async () => {
      // Apply all prerequisite migrations
      for (let i = 0; i < 3; i++) {
        const migration = migrationExecutor.getMigrationFiles('up')[i];
        const sql = require('fs').readFileSync(
          path.join(__dirname, '../../migrations', migration),
          'utf-8',
        );
        await dataSource.query(sql);
      }
    });

    it('should create plans table with correct schema', async () => {
      const tables = await migrationExecutor.getTableNames();
      expect(tables).toContain('plans');

      const columns = await migrationExecutor.getTableColumns('plans');
      expect(columns).toContain('id');
      expect(columns).toContain('creator_id');
      expect(columns).toContain('name');
      expect(columns).toContain('description');
      expect(columns).toContain('price_cents');
      expect(columns).toContain('billing_interval');
      expect(columns).toContain('is_active');
      expect(columns).toContain('created_at');
      expect(columns).toContain('updated_at');
    });

    it('should create required indexes on plans table', async () => {
      const indexes = await migrationExecutor.getTableIndexes('plans');
      const indexNames = indexes.map((idx) => idx.indexname);

      expect(indexNames).toContain('idx_plans_creator_id');
      expect(indexNames).toContain('idx_plans_is_active');
      expect(indexNames).toContain('idx_plans_creator_id_is_active');
    });

    it('should enforce price_cents >= 0 constraint', async () => {
      // Create user and creator first
      const userResult = await dataSource.query(
        `INSERT INTO users (email, username, password_hash) 
         VALUES ($1, $2, $3) RETURNING id`,
        ['plan-creator@example.com', 'planuser', 'hash123'],
      );
      const userId = userResult[0].id;

      const creatorResult = await dataSource.query(
        `INSERT INTO creators (user_id, slug) 
         VALUES ($1, $2) RETURNING id`,
        [userId, 'plan-creator-slug'],
      );
      const creatorId = creatorResult[0].id;

      // Try to insert plan with negative price - should fail
      await expect(
        dataSource.query(
          `INSERT INTO plans (creator_id, name, price_cents, billing_interval) 
           VALUES ($1, $2, $3, $4)`,
          [creatorId, 'Invalid Plan', -100, 'monthly'],
        ),
      ).rejects.toThrow();
    });

    it('should verify billing_interval enum values', async () => {
      const userResult = await dataSource.query(
        `INSERT INTO users (email, username, password_hash) 
         VALUES ($1, $2, $3) RETURNING id`,
        ['interval-user@example.com', 'intervaluser', 'hash123'],
      );
      const userId = userResult[0].id;

      const creatorResult = await dataSource.query(
        `INSERT INTO creators (user_id, slug) 
         VALUES ($1, $2) RETURNING id`,
        [userId, 'interval-creator-slug'],
      );
      const creatorId = creatorResult[0].id;

      // Valid enum value should work
      const result = await dataSource.query(
        `INSERT INTO plans (creator_id, name, price_cents, billing_interval) 
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [creatorId, 'Monthly Plan', 999, 'monthly'],
      );
      expect(result[0].id).toBeDefined();

      // Invalid enum value should fail
      await expect(
        dataSource.query(
          `INSERT INTO plans (creator_id, name, price_cents, billing_interval) 
           VALUES ($1, $2, $3, $4)`,
          [creatorId, 'Invalid Interval Plan', 999, 'weekly'],
        ),
      ).rejects.toThrow();
    });
  });

  describe('Migration: 004_create_content', () => {
    beforeEach(async () => {
      for (let i = 0; i < 4; i++) {
        const migration = migrationExecutor.getMigrationFiles('up')[i];
        const sql = require('fs').readFileSync(
          path.join(__dirname, '../../migrations', migration),
          'utf-8',
        );
        await dataSource.query(sql);
      }
    });

    it('should create content table with correct schema', async () => {
      const tables = await migrationExecutor.getTableNames();
      expect(tables).toContain('content');

      const columns = await migrationExecutor.getTableColumns('content');
      expect(columns).toContain('id');
      expect(columns).toContain('creator_id');
      expect(columns).toContain('title');
      expect(columns).toContain('slug');
      expect(columns).toContain('body');
      expect(columns).toContain('media_url');
      expect(columns).toContain('visibility');
      expect(columns).toContain('published_at');
      expect(columns).toContain('created_at');
      expect(columns).toContain('updated_at');
    });

    it('should create required indexes on content table', async () => {
      const indexes = await migrationExecutor.getTableIndexes('content');
      const indexNames = indexes.map((idx) => idx.indexname);

      expect(indexNames).toContain('idx_content_creator_id');
      expect(indexNames).toContain('idx_content_visibility');
      expect(indexNames).toContain('idx_content_published_at');
      expect(indexNames).toContain('idx_content_published');
    });

    it('should verify visibility enum values', async () => {
      const userResult = await dataSource.query(
        `INSERT INTO users (email, username, password_hash) 
         VALUES ($1, $2, $3) RETURNING id`,
        ['content-creator@example.com', 'contentuser', 'hash123'],
      );
      const userId = userResult[0].id;

      const creatorResult = await dataSource.query(
        `INSERT INTO creators (user_id, slug) 
         VALUES ($1, $2) RETURNING id`,
        [userId, 'content-creator-slug'],
      );
      const creatorId = creatorResult[0].id;

      // Valid enum value should work
      const result = await dataSource.query(
        `INSERT INTO content (creator_id, title, visibility) 
         VALUES ($1, $2, $3) RETURNING id`,
        [creatorId, 'Public Post', 'public'],
      );
      expect(result[0].id).toBeDefined();

      // Invalid enum value should fail
      await expect(
        dataSource.query(
          `INSERT INTO content (creator_id, title, visibility) 
           VALUES ($1, $2, $3)`,
          [creatorId, 'Invalid Visibility Post', 'restricted'],
        ),
      ).rejects.toThrow();
    });

    it('should enforce unique constraint on slug', async () => {
      const userResult = await dataSource.query(
        `INSERT INTO users (email, username, password_hash) 
         VALUES ($1, $2, $3) RETURNING id`,
        ['slug-creator@example.com', 'sluguser', 'hash123'],
      );
      const userId = userResult[0].id;

      const creatorResult = await dataSource.query(
        `INSERT INTO creators (user_id, slug) 
         VALUES ($1, $2) RETURNING id`,
        [userId, 'slug-creator'],
      );
      const creatorId = creatorResult[0].id;

      // Insert first content
      await dataSource.query(
        `INSERT INTO content (creator_id, title, slug, visibility, published_at) 
         VALUES ($1, $2, $3, $4, $5)`,
        [creatorId, 'First Post', 'unique-slug', 'public', new Date()],
      );

      // Try to insert another with same slug - should fail
      await expect(
        dataSource.query(
          `INSERT INTO content (creator_id, title, slug, visibility, published_at) 
           VALUES ($1, $2, $3, $4, $5)`,
          [creatorId, 'Second Post', 'unique-slug', 'public', new Date()],
        ),
      ).rejects.toThrow();
    });
  });

  describe('Migration: 005_create_subscriptions', () => {
    beforeEach(async () => {
      for (let i = 0; i < 5; i++) {
        const migration = migrationExecutor.getMigrationFiles('up')[i];
        const sql = require('fs').readFileSync(
          path.join(__dirname, '../../migrations', migration),
          'utf-8',
        );
        await dataSource.query(sql);
      }
    });

    it('should create subscriptions table with correct schema', async () => {
      const tables = await migrationExecutor.getTableNames();
      expect(tables).toContain('subscriptions');

      const columns = await migrationExecutor.getTableColumns('subscriptions');
      expect(columns).toContain('id');
      expect(columns).toContain('user_id');
      expect(columns).toContain('plan_id');
      expect(columns).toContain('status');
      expect(columns).toContain('started_at');
      expect(columns).toContain('expires_at');
      expect(columns).toContain('created_at');
      expect(columns).toContain('updated_at');
    });

    it('should create required indexes on subscriptions table', async () => {
      const indexes = await migrationExecutor.getTableIndexes('subscriptions');
      const indexNames = indexes.map((idx) => idx.indexname);

      expect(indexNames).toContain('idx_subscriptions_user_id');
      expect(indexNames).toContain('idx_subscriptions_plan_id');
      expect(indexNames).toContain('idx_subscriptions_status');
      expect(indexNames).toContain('idx_subscriptions_user_status');
      expect(indexNames).toContain('idx_subscriptions_plan_status');
      expect(indexNames).toContain('idx_subscriptions_expires_at');
    });

    it('should verify subscription status enum values', async () => {
      // Create full hierarchy: user -> creator -> plan -> subscription
      const userResult = await dataSource.query(
        `INSERT INTO users (email, username, password_hash) 
         VALUES ($1, $2, $3) RETURNING id`,
        ['sub-user@example.com', 'subuser', 'hash123'],
      );
      const userId = userResult[0].id;

      const creatorResult = await dataSource.query(
        `INSERT INTO users (email, username, password_hash) 
         VALUES ($1, $2, $3) RETURNING id`,
        ['creator@example.com', 'creator', 'hash123'],
      );
      const creatorUserId = creatorResult[0].id;

      const creatorObj = await dataSource.query(
        `INSERT INTO creators (user_id, slug) 
         VALUES ($1, $2) RETURNING id`,
        [creatorUserId, 'test-creator'],
      );
      const creatorId = creatorObj[0].id;

      const planResult = await dataSource.query(
        `INSERT INTO plans (creator_id, name, price_cents, billing_interval) 
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [creatorId, 'Test Plan', 999, 'monthly'],
      );
      const planId = planResult[0].id;

      // Valid status should work
      const result = await dataSource.query(
        `INSERT INTO subscriptions (user_id, plan_id, status, started_at) 
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [userId, planId, 'active', new Date()],
      );
      expect(result[0].id).toBeDefined();

      // Invalid status should fail
      await expect(
        dataSource.query(
          `INSERT INTO subscriptions (user_id, plan_id, status, started_at) 
           VALUES ($1, $2, $3, $4)`,
          [userId, planId, 'suspended', new Date()],
        ),
      ).rejects.toThrow();
    });
  });

  describe('Full migration lifecycle', () => {
    it('should apply all migrations in correct order', async () => {
      // Clean state
      try {
        const tables = await migrationExecutor.getTableNames();
        if (tables.length > 0) {
          await migrationExecutor.migrateDown();
        }
      } catch (err) {
        // continue
      }

      // Apply all migrations
      await migrationExecutor.migrateUp();

      // Verify all tables exist
      const tables = await migrationExecutor.getTableNames();
      expect(tables).toContain('users');
      expect(tables).toContain('creators');
      expect(tables).toContain('plans');
      expect(tables).toContain('content');
      expect(tables).toContain('subscriptions');
    });

    it('should rollback all migrations in reverse order', async () => {
      // Ensure migrations are applied
      const tables = await migrationExecutor.getTableNames();
      if (!tables.includes('users')) {
        await migrationExecutor.migrateUp();
      }

      // Rollback
      await migrationExecutor.migrateDown();

      // Verify all tables are removed
      const remainingTables = await migrationExecutor.getTableNames();
      expect(remainingTables).not.toContain('users');
      expect(remainingTables).not.toContain('creators');
      expect(remainingTables).not.toContain('plans');
      expect(remainingTables).not.toContain('content');
      expect(remainingTables).not.toContain('subscriptions');
    });
  });
});
