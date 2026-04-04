-- Migration: 005_create_subscriptions
-- Description: Creates the subscriptions table with user and plan foreign keys
-- Up migration for MyFans PostgreSQL baseline schema

BEGIN;

-- Create ENUM types
CREATE TYPE subscription_status AS ENUM ('active', 'cancelled', 'expired');

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  status subscription_status NOT NULL DEFAULT 'active',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT subscriptions_started_at_required CHECK (started_at IS NOT NULL),
  CONSTRAINT subscriptions_dates_logic CHECK (
    expires_at IS NULL OR expires_at >= started_at
  )
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id ON subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status 
  ON subscriptions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_status 
  ON subscriptions(plan_id, status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_expires_at 
  ON subscriptions(expires_at) WHERE expires_at IS NOT NULL;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_subscriptions_updated_at
BEFORE UPDATE ON subscriptions
FOR EACH ROW
EXECUTE FUNCTION update_subscriptions_updated_at();

COMMIT;
