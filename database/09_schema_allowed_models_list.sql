-- ════════════════════════════════════════════════════════════════
-- CV PILOT — PER-USER MODEL ACCESS LIST
-- Run this in Supabase SQL Editor AFTER 03_schema_model_assignment.sql
-- ════════════════════════════════════════════════════════════════

-- Add allowed_models column (JSON array of model IDs the user can access).
-- NULL means "all models allowed".  An array restricts to those IDs only.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS allowed_models JSONB DEFAULT NULL;

-- Update the check constraint to include all 2026 models
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS chk_allowed_model;

ALTER TABLE users
  ADD CONSTRAINT chk_allowed_model CHECK (
    allowed_model IN (
      'claude-haiku-4-5',
      'claude-haiku-4-5-20251001',
      'claude-sonnet-4-6',
      'claude-opus-4-6',
      'gpt-4.1-nano',
      'gpt-4.1-mini',
      'gpt-4.1',
      'gpt-5.4-mini'
    )
  );

-- Update model_updated_at/by columns in model_change_log if needed
-- (already exist from 03 migration — this is a no-op)
ALTER TABLE model_change_log
  ALTER COLUMN new_model TYPE VARCHAR(80),
  ALTER COLUMN previous_model TYPE VARCHAR(80);
