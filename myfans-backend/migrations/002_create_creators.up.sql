-- Migration: 002_create_creators
-- Description: Creates the creators table with user foreign key
-- Up migration for MyFans PostgreSQL baseline schema

BEGIN;

-- Create creators table
CREATE TABLE IF NOT EXISTS creators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  headline VARCHAR(255),
  description TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT creators_slug_not_empty CHECK (slug != ''),
  CONSTRAINT creators_is_verified_boolean CHECK (is_verified IN (true, false))
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_creators_user_id ON creators(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_creators_slug ON creators(slug);
CREATE INDEX IF NOT EXISTS idx_creators_is_verified ON creators(is_verified);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_creators_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_creators_updated_at
BEFORE UPDATE ON creators
FOR EACH ROW
EXECUTE FUNCTION update_creators_updated_at();

COMMIT;
