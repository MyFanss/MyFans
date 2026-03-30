-- Migration: 002_create_creators
-- Description: Rollback for creators table creation
-- Down migration for MyFans PostgreSQL baseline schema

BEGIN;

-- Drop trigger
DROP TRIGGER IF EXISTS trigger_creators_updated_at ON creators;

-- Drop function
DROP FUNCTION IF EXISTS update_creators_updated_at();

-- Drop indexes
DROP INDEX IF EXISTS idx_creators_is_verified;
DROP INDEX IF EXISTS idx_creators_slug;
DROP INDEX IF EXISTS idx_creators_user_id;

-- Drop table
DROP TABLE IF EXISTS creators CASCADE;

COMMIT;
