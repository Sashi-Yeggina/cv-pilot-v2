-- ════════════════════════════════════════════════════════════════
-- CV PILOT v3 — PER-USER MODEL SETTINGS
-- Run this in Supabase SQL Editor AFTER running v2 migration.
-- ════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────
-- Extend users table with model configuration columns
-- ────────────────────────────────────────────────────────────────

-- The Claude model this user is allowed to use for CV generation.
-- Admin sets this per-user. Falls back to system default (Haiku) if NULL.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS allowed_model   VARCHAR(60)  DEFAULT 'claude-haiku-4-5-20251001',
  ADD COLUMN IF NOT EXISTS model_label     VARCHAR(30)  DEFAULT 'Haiku (Fast · Low Cost)',
  ADD COLUMN IF NOT EXISTS model_updated_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS model_updated_by VARCHAR(255);  -- admin email who changed it

-- Valid model values:
--   'claude-haiku-4-5-20251001'   → fastest, cheapest  (~$0.25/M input tokens)
--   'claude-sonnet-4-6'           → balanced quality   (~$3/M input tokens)
--   'claude-opus-4-6'             → highest quality    (~$15/M input tokens)

-- Add a check constraint so only known models can be stored
ALTER TABLE users
  ADD CONSTRAINT chk_allowed_model CHECK (
    allowed_model IN (
      'claude-haiku-4-5-20251001',
      'claude-sonnet-4-6',
      'claude-opus-4-6'
    )
  );

-- Back-fill existing rows with the default
UPDATE users
  SET allowed_model  = 'claude-haiku-4-5-20251001',
      model_label    = 'Haiku (Fast · Low Cost)'
WHERE allowed_model IS NULL;

-- ────────────────────────────────────────────────────────────────
-- Audit log: track every time an admin changes a user's model
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS model_change_log (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  changed_by     VARCHAR(255) NOT NULL,   -- admin email
  previous_model VARCHAR(60),
  new_model      VARCHAR(60) NOT NULL,
  reason         TEXT,                    -- optional note from admin
  created_at     TIMESTAMP   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_model_log_user ON model_change_log(user_id);
CREATE INDEX IF NOT EXISTS idx_model_log_time ON model_change_log(created_at DESC);

-- RLS: only admins can read/write model_change_log
ALTER TABLE model_change_log ENABLE ROW LEVEL SECURITY;

-- Admins bypass RLS via service-role key (backend uses service key)
-- If you want fine-grained policies, add them here.
