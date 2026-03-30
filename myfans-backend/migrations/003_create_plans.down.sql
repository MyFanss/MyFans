-- Migration: 003_create_plans
-- Description: Rollback for plans table creation
-- Down migration for MyFans PostgreSQL baseline schema

BEGIN;

-- Drop trigger
DROP TRIGGER IF EXISTS trigger_plans_updated_at ON plans;

-- Drop function
DROP FUNCTION IF EXISTS update_plans_updated_at();

-- Drop indexes
DROP INDEX IF EXISTS idx_plans_creator_id_is_active;
DROP INDEX IF EXISTS idx_plans_is_active;
DROP INDEX IF EXISTS idx_plans_creator_id;

-- Drop table
DROP TABLE IF EXISTS plans CASCADE;

-- Drop ENUM type
DROP TYPE IF EXISTS billing_interval;

COMMIT;
