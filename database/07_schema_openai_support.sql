-- ════════════════════════════════════════════════════════════════
-- Migration 07: Add OpenAI Support
-- Date: April 18, 2026
-- Purpose: Add provider tracking and cost columns for multi-provider support
-- ════════════════════════════════════════════════════════════════

-- Track which provider (Claude or OpenAI) was used for each generation
ALTER TABLE cv_generations
ADD COLUMN IF NOT EXISTS provider VARCHAR(20) DEFAULT 'claude';

-- Index for filtering by provider (performance optimization)
CREATE INDEX IF NOT EXISTS idx_cv_generations_provider
ON cv_generations(provider);

-- Add provider tracking to users table (which provider they use)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS allowed_model_provider VARCHAR(20) DEFAULT 'claude';

-- Track why a model was disabled (admin notes)
ALTER TABLE cv_generations
ADD COLUMN IF NOT EXISTS model_disabled_reason TEXT;

-- More accurate cost tracking
ALTER TABLE cv_generations
ADD COLUMN IF NOT EXISTS estimated_cost DECIMAL(10, 6),
ADD COLUMN IF NOT EXISTS actual_cost DECIMAL(10, 6),
ADD COLUMN IF NOT EXISTS generation_seconds INT DEFAULT 0;

-- Timestamp trigger for automatic updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to cv_generations for timestamp updates
DROP TRIGGER IF EXISTS update_cv_generations_updated_at ON cv_generations;
CREATE TRIGGER update_cv_generations_updated_at
BEFORE UPDATE ON cv_generations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ✅ Migration 07 complete
