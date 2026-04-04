-- Migration: 005_create_subscriptions
-- Description: Rollback for subscriptions table creation
-- Down migration for MyFans PostgreSQL baseline schema

BEGIN;

-- Drop trigger
DROP TRIGGER IF EXISTS trigger_subscriptions_updated_at ON subscriptions;

-- Drop function
DROP FUNCTION IF EXISTS update_subscriptions_updated_at();

-- Drop indexes
DROP INDEX IF EXISTS idx_subscriptions_plan_status;
DROP INDEX IF EXISTS idx_subscriptions_user_status;
DROP INDEX IF EXISTS idx_subscriptions_status;
DROP INDEX IF EXISTS idx_subscriptions_plan_id;
DROP INDEX IF EXISTS idx_subscriptions_user_id;
DROP INDEX IF EXISTS idx_subscriptions_expires_at;

-- Drop table
DROP TABLE IF EXISTS subscriptions CASCADE;

-- Drop ENUM type
DROP TYPE IF EXISTS subscription_status;

COMMIT;
