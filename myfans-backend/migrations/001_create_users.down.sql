-- Migration: 001_create_users
-- Description: Rollback for users table creation
-- Down migration for MyFans PostgreSQL baseline schema

BEGIN;

-- Drop trigger
DROP TRIGGER IF EXISTS trigger_users_updated_at ON users;

-- Drop function
DROP FUNCTION IF EXISTS update_users_updated_at();

-- Drop indexes
DROP INDEX IF EXISTS idx_users_created_at;
DROP INDEX IF EXISTS idx_users_username;
DROP INDEX IF EXISTS idx_users_email;

-- Drop table
DROP TABLE IF EXISTS users CASCADE;

COMMIT;
