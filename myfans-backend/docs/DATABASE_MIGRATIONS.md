# Database Migration Guide - MyFans Backend

This guide covers the production-ready database migration system for the MyFans backend.

## Overview

The database schema is managed through:

- **TypeORM Entities** (`src/database/entities/`) - Define the schema in TypeScript
- **Raw SQL Migrations** (`migrations/`) - Version-controlled SQL files for reproducible deploys
- **Migration Tests** (`test/migrations/`) - Verify schema integrity
- **Seed Tests** (`test/seed/`) - Verify data queries and performance

## Core Tables

### 1. Users Table
- Primary table for platform users (creators and fans)
- **Key fields**: id, email, username, password_hash, display_name, bio, is_active
- **Indexes**: email (unique), username (unique), created_at
- **Constraints**: NOT NULL on email/username, CHECK on is_active

### 2. Creators Table
- Links users to creator profiles
- **Key fields**: id, user_id (FK to users), slug, headline, description, is_verified
- **Indexes**: user_id, slug (unique), is_verified
- **Foreign Keys**: CASCADE delete on user deletion

### 3. Plans Table
- Subscription plans offered by creators
- **Key fields**: id, creator_id (FK), name, price_cents, billing_interval, is_active
- **Indexes**: creator_id, is_active, composite (creator_id, is_active)
- **Constraints**: price_cents >= 0, billing_interval IN ('monthly', 'yearly')
- **Enum**: BillingInterval (monthly, yearly)

### 4. Content Table
- Creator content (posts, media, etc.)
- **Key fields**: id, creator_id (FK), title, body, media_url, visibility, published_at
- **Indexes**: creator_id, visibility, published_at, composite (creator_id, published_at DESC)
- **Enum**: ContentVisibility (public, subscribers_only, premium)

### 5. Subscriptions Table
- Fan subscriptions to creator plans
- **Key fields**: id, user_id (FK), plan_id (FK), status, started_at, expires_at
- **Indexes**: user_id, plan_id, status, composite (user_id, status), composite (plan_id, status)
- **Enum**: SubscriptionStatus (active, cancelled, expired)
- **Constraints**: expires_at >= started_at

## Running Migrations

### 1. Local Development

#### Prerequisites
```bash
# Install dependencies
npm install

# Create .env file with database credentials
cp .env.example .env
# Edit .env with your database config
```

#### Apply Migrations
```bash
# Apply all up migrations
npx ts-node src/database/migrations.runner.ts up

# Rollback all migrations
npx ts-node src/database/migrations.runner.ts down
```

#### Using TypeORM CLI
```bash
# Alternative: Use TypeORM CLI
npx typeorm migration:run -d src/database/data-source.ts
npx typeorm migration:revert -d src/database/data-source.ts
```

### 2. Docker Development

```bash
# Start PostgreSQL container
docker-compose up -d postgres

# Wait for database to be ready
sleep 5

# Run migrations
npm run db:migrate

# Verify schema
npm run db:seed:test
```

### 3. CI/CD Pipeline

Add to your CI configuration (GitHub Actions example):

```yaml
- name: Run Database Migrations
  env:
    DB_HOST: localhost
    DB_PORT: 5432
    DB_USERNAME: myfans
    DB_PASSWORD: password
    DB_NAME: myfans_test
  run: |
    npm install
    npx ts-node src/database/migrations.runner.ts up
    npm run test:migrations
    npm run test:seed
```

### 4. Production Deployment

```bash
# Backup database (CRITICAL!)
pg_dump -h $DB_HOST -U $DB_USER $DB_NAME > backup-$(date +%s).sql

# Verify migrations locally first
npx ts-node src/database/migrations.runner.ts up

# On success, deploy to production
export DB_HOST=prod.example.com
export DB_PORT=5432
export DB_USERNAME=$PROD_DB_USER
export DB_PASSWORD=$PROD_DB_PASSWORD
export DB_NAME=myfans

npx ts-node src/database/migrations.runner.ts up

# Verify
npm run db:health-check
```

## Testing Migrations

### Run Migration Tests
```bash
# Run all migration tests
npm run test:migrations

# Run specific test
npm run test -- migrations.spec.ts

# Run with coverage
npm run test:cov -- migrations
```

### Migration Test Coverage

The migration tests verify:

✓ All tables are created with correct schemas  
✓ All indexes exist and are properly defined  
✓ Foreign key constraints work correctly  
✓ Unique constraints are enforced  
✓ CHECK constraints validate data  
✓ ON DELETE CASCADE relationships work  
✓ Rollback operations completely reverse schema  
✓ ENUM types are properly constrained  

### Run Seed & Query Tests
```bash
# Apply migrations and test queries
npm run test:seed

# Verify specific query performance
npm run test -- seed.spec.ts -t "efficiently query"
```

## Migration Files Structure

```
migrations/
├── 001_create_users.up.sql        # Create users table
├── 001_create_users.down.sql       # Rollback users table
├── 002_create_creators.up.sql      # Create creators table
├── 002_create_creators.down.sql    # Rollback creators table
├── 003_create_plans.up.sql         # Create plans table
├── 003_create_plans.down.sql       # Rollback plans table
├── 004_create_content.up.sql       # Create content table
├── 004_create_content.down.sql     # Rollback content table
├── 005_create_subscriptions.up.sql # Create subscriptions table
└── 005_create_subscriptions.down.sql # Rollback subscriptions table
```

## Adding New Migrations

### Step 1: Create Migration Files

```bash
# Create new migration pair
touch migrations/NNN_description.up.sql
touch migrations/NNN_description.down.sql
```

### Step 2: Write SQL

**Up Migration Example** (`006_add_creator_badges.up.sql`):
```sql
BEGIN;

ALTER TABLE creators ADD COLUMN badges JSONB DEFAULT '[]'::jsonb;
CREATE INDEX idx_creators_badges ON creators USING GIN(badges);

COMMIT;
```

**Down Migration** (`006_add_creator_badges.down.sql`):
```sql
BEGIN;

DROP INDEX IF EXISTS idx_creators_badges;
ALTER TABLE creators DROP COLUMN badges;

COMMIT;
```

### Step 3: Update TypeORM Entity

Update the corresponding entity to reflect schema changes:
```typescript
@Column({ type: 'jsonb', default: [] })
badges: Record<string, any>[];
```

### Step 4: Test

```bash
# Apply new migration
npx ts-node src/database/migrations.runner.ts up

# Test queries
npm run test:seed

# Rollback to verify down migration
npx ts-node src/database/migrations.runner.ts down
```

## Index Strategy

### Query Performance Indexes

1. **User Lookups**
   - `idx_users_email` - Login by email
   - `idx_users_username` - Profile lookups

2. **Creator Discovery**
   - `idx_creators_slug` - Creator profile URLs
   - `idx_creators_is_verified` - Filter verified creators

3. **Plan Filtering**
   - `idx_plans_creator_id` - Creator's plans
   - `idx_plans_is_active` - Only active plans
   - `idx_plans_creator_id_is_active` - Combined filter

4. **Content Queries**
   - `idx_content_creator_id` - Creator's content
   - `idx_content_visibility` - Filter by visibility
   - `idx_content_published_at` - Recent content
   - `idx_content_creator_published_at` - Creator's recent posts (DESC)

5. **Subscription Lookups**
   - `idx_subscriptions_user_id` - User's subscriptions
   - `idx_subscriptions_plan_id` - Plan's subscribers
   - `idx_subscriptions_status` - By status
   - `idx_subscriptions_user_status` - User's active subscriptions
   - `idx_subscriptions_plan_status` - Plan's active subscribers

## Enum Types

PostgreSQL ENUM types used in the schema:

```sql
-- Billing intervals for subscription plans
CREATE TYPE billing_interval AS ENUM ('monthly', 'yearly');

-- Content visibility levels
CREATE TYPE content_visibility AS ENUM ('public', 'subscribers_only', 'premium');

-- Subscription status lifecycle
CREATE TYPE subscription_status AS ENUM ('active', 'cancelled', 'expired');
```

## Triggers

All tables have `updated_at` triggers to automatically update the timestamp on record modifications:

```sql
CREATE TRIGGER trigger_{table_name}_updated_at
BEFORE UPDATE ON {table_name}
FOR EACH ROW
EXECUTE FUNCTION update_{table_name}_updated_at();
```

## Query Examples

### Find Creator by Slug (with Verified Badge)
```sql
SELECT id, user_id, headline, is_verified, created_at
FROM creators
WHERE slug = $1 AND is_verified = TRUE;
```

### Get Active Plans for Creator (sorted by price)
```sql
SELECT id, name, price_cents, billing_interval
FROM plans
WHERE creator_id = $1 AND is_active = TRUE
ORDER BY price_cents ASC;
```

### Get Recent Public Content
```sql
SELECT id, title, media_url, published_at
FROM content
WHERE creator_id = $1 
  AND visibility = 'public' 
  AND published_at IS NOT NULL
ORDER BY published_at DESC
LIMIT 10;
```

### Get User's Active Subscriptions (with Plan Details)
```sql
SELECT s.id, p.name, p.price_cents, p.billing_interval, s.expires_at
FROM subscriptions s
JOIN plans p ON s.plan_id = p.id
WHERE s.user_id = $1 AND s.status = 'active'
ORDER BY s.created_at DESC;
```

### Count Active Subscribers per Plan
```sql
SELECT plan_id, COUNT(*) as subscriber_count
FROM subscriptions
WHERE status = 'active'
GROUP BY plan_id;
```

## Common Issues & Solutions

### Issue: Migrations Won't Apply
```bash
# Check database connection
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT 1"

# Check existing migrations
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT * FROM information_schema.tables WHERE table_schema = 'public'"
```

### Issue: Foreign Key Constraint Violation
```bash
# List all constraints
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "\d creators"

# Check migration order - ensure parent tables created first
```

### Issue: Enum Type Already Exists
```bash
# If duplicate enum error, check existing types
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT * FROM pg_type WHERE typname LIKE 'billing%'"

# Remove if needed (careful in production!)
# DROP TYPE IF EXISTS billing_interval CASCADE;
```

## Performance Monitoring

Monitor query performance with:

```bash
# Enable slow query logging
npm run db:monitor-queries

# Check indexes usage
npm run db:analyze-indexes

# Generate performance report
npm run test:performance
```

## Backing Up Database

```bash
# Full backup
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME -Fc > backup.dump

# Point-in-time recovery
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME --wal-method=fetch > backup-wal.sql

# Restore from backup
pg_restore -h $DB_HOST -U $DB_USER -d $DB_NAME backup.dump
```

## Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [TypeORM Migration Docs](https://typeorm.io/migrations)
- [PostgreSQL ENUM Types](https://www.postgresql.org/docs/current/datatype-enum.html)
- [Index Strategies](https://www.postgresql.org/docs/current/indexes.html)
- [Foreign Keys and Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)
