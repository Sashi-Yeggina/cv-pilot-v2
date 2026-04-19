-- ════════════════════════════════════════════════════════════════
-- Migration 08: Model Settings & Tier-Based Visibility
-- Date: April 18, 2026
-- Purpose: Admin control over model availability and tier-based visibility
-- ════════════════════════════════════════════════════════════════

-- Admin-controlled settings for each AI model
CREATE TABLE IF NOT EXISTS model_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Model identification
  model_id VARCHAR(50) NOT NULL UNIQUE,
  provider VARCHAR(20) NOT NULL, -- 'claude' or 'openai'
  model_name VARCHAR(100) NOT NULL,

  -- Admin controls
  is_enabled BOOLEAN DEFAULT true,
  disabled_reason TEXT,

  -- Tier-based visibility
  is_visible_to_free_tier BOOLEAN DEFAULT false,
  is_visible_to_pro_tier BOOLEAN DEFAULT true,
  is_visible_to_enterprise_tier BOOLEAN DEFAULT true,

  -- Cost & speed info (shown to users)
  cost_per_cv DECIMAL(10, 6) NOT NULL,
  estimated_speed_seconds INT DEFAULT 10,
  quality_tier VARCHAR(20),
  recommendation_text TEXT,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Timestamp trigger for automatic updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_model_settings_updated_at ON model_settings;
CREATE TRIGGER update_model_settings_updated_at
BEFORE UPDATE ON model_settings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_model_settings_provider ON model_settings(provider);
CREATE INDEX IF NOT EXISTS idx_model_settings_enabled ON model_settings(is_enabled);

-- Add user's preferred model
ALTER TABLE users
ADD COLUMN IF NOT EXISTS preferred_model VARCHAR(50);

-- Insert default models (costs are examples - update in Supabase UI if needed)
INSERT INTO model_settings (
  model_id, provider, model_name, cost_per_cv,
  estimated_speed_seconds, quality_tier, recommendation_text,
  is_visible_to_pro_tier, is_visible_to_enterprise_tier
)
VALUES
  -- Claude Models
  ('claude-haiku-4-5', 'claude', 'Claude Haiku', 0.0008, 4, 'budget', 'Fast & cheap', true, true),
  ('claude-sonnet-4-6', 'claude', 'Claude Sonnet', 0.003, 7, 'balanced', 'Best balance', true, true),
  ('claude-opus-4-6', 'claude', 'Claude Opus', 0.015, 12, 'premium', 'Most capable', false, true),

  -- OpenAI Models
  ('gpt-3.5-turbo', 'openai', 'GPT-3.5 Turbo', 0.0005, 3, 'budget', 'Fastest & cheapest', true, true),
  ('gpt-4o', 'openai', 'GPT-4o', 0.005, 6, 'balanced', 'Latest, multimodal', true, true),
  ('gpt-4-turbo', 'openai', 'GPT-4 Turbo', 0.010, 10, 'premium', 'Most powerful', false, true)
ON CONFLICT DO NOTHING;

-- Track user's model usage (for recommendations)
CREATE TABLE IF NOT EXISTS user_model_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  model_id VARCHAR(50) NOT NULL,
  times_used INT DEFAULT 1,
  last_used_at TIMESTAMP DEFAULT NOW(),
  total_cost_spent DECIMAL(10, 6) DEFAULT 0,

  UNIQUE(user_id, model_id)
);

CREATE INDEX IF NOT EXISTS idx_user_model_usage_user ON user_model_usage(user_id);

-- ✅ Migration 08 complete
