-- Migration: 004_create_content
-- Description: Rollback for content table creation
-- Down migration for MyFans PostgreSQL baseline schema

BEGIN;

-- Drop trigger
DROP TRIGGER IF EXISTS trigger_content_updated_at ON content;

-- Drop function
DROP FUNCTION IF EXISTS update_content_updated_at();

-- Drop indexes
DROP INDEX IF EXISTS idx_content_creator_published_at;
DROP INDEX IF EXISTS idx_content_published_at;
DROP INDEX IF EXISTS idx_content_visibility;
DROP INDEX IF EXISTS idx_content_creator_id;
DROP INDEX IF EXISTS idx_content_published;

-- Drop table
DROP TABLE IF EXISTS content CASCADE;

-- Drop ENUM type
DROP TYPE IF EXISTS content_visibility;

COMMIT;
