-- Migration: 004_create_content
-- Description: Creates the content table with creator foreign key
-- Up migration for MyFans PostgreSQL baseline schema

BEGIN;

-- Create ENUM types
CREATE TYPE content_visibility AS ENUM ('public', 'subscribers_only', 'premium');

-- Create content table
CREATE TABLE IF NOT EXISTS content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  body TEXT,
  media_url VARCHAR(2083),
  visibility content_visibility NOT NULL DEFAULT 'public',
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT content_title_not_empty CHECK (title != ''),
  CONSTRAINT content_slug_not_empty CHECK (slug != ''),
  CONSTRAINT content_published_at_logic CHECK (
    (visibility = 'public' AND published_at IS NOT NULL) OR
    (visibility != 'public')
  )
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_content_creator_id ON content(creator_id);
CREATE INDEX IF NOT EXISTS idx_content_visibility ON content(visibility);
CREATE INDEX IF NOT EXISTS idx_content_published_at ON content(published_at);
CREATE INDEX IF NOT EXISTS idx_content_creator_published_at 
  ON content(creator_id, published_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_content_published 
  ON content(creator_id, published_at DESC) WHERE visibility = 'public';

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_content_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_content_updated_at
BEFORE UPDATE ON content
FOR EACH ROW
EXECUTE FUNCTION update_content_updated_at();

COMMIT;
