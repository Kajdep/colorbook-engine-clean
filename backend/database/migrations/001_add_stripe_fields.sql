-- Migration: Add Stripe fields to users table
-- Created: 2025-06-03
-- Description: Add stripe_customer_id and stripe_subscription_id fields to support payment integration

-- Add Stripe customer ID field
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255) UNIQUE;

-- Add Stripe subscription ID field  
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255) UNIQUE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_stripe_subscription ON users(stripe_subscription_id);

-- Insert migration record
INSERT INTO migrations (filename) VALUES ('001_add_stripe_fields.sql')
ON CONFLICT (filename) DO NOTHING;
