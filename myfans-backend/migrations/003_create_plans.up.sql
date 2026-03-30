-- Migration: 003_create_plans
-- Description: Creates the plans table with creator foreign key
-- Up migration for MyFans PostgreSQL baseline schema

BEGIN;

-- Create ENUM types
CREATE TYPE billing_interval AS ENUM ('monthly', 'yearly');

-- Create plans table
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL,
  billing_interval billing_interval NOT NULL DEFAULT 'monthly',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT plans_name_not_empty CHECK (name != ''),
  CONSTRAINT plans_price_cents_non_negative CHECK (price_cents >= 0),
  CONSTRAINT plans_is_active_boolean CHECK (is_active IN (true, false))
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_plans_creator_id ON plans(creator_id);
CREATE INDEX IF NOT EXISTS idx_plans_is_active ON plans(is_active);
CREATE INDEX IF NOT EXISTS idx_plans_creator_id_is_active ON plans(creator_id, is_active);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_plans_updated_at
BEFORE UPDATE ON plans
FOR EACH ROW
EXECUTE FUNCTION update_plans_updated_at();

COMMIT;
