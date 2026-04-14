-- ════════════════════════════════════════════════════════════════
-- CV PILOT v4 — PER-GENERATION COST TRACKING
-- Run AFTER v3 migration.
-- ════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────
-- Extend cv_assembly_log with model + accurate token breakdown
-- ────────────────────────────────────────────────────────────────

ALTER TABLE cv_assembly_log
  ADD COLUMN IF NOT EXISTS model_used       VARCHAR(60)  DEFAULT 'claude-haiku-4-5-20251001',
  ADD COLUMN IF NOT EXISTS input_tokens     INT          DEFAULT 0,
  ADD COLUMN IF NOT EXISTS output_tokens    INT          DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_cost_usd NUMERIC(10,6) DEFAULT 0.000000;

-- Index for fast per-user cost queries
CREATE INDEX IF NOT EXISTS idx_assembly_log_model ON cv_assembly_log(model_used);

-- Back-fill existing rows: tokens_used was stored as a combined figure,
-- split 70/30 as a reasonable approximation for historical data.
UPDATE cv_assembly_log
SET
  model_used    = 'claude-haiku-4-5-20251001',
  input_tokens  = ROUND(tokens_used * 0.7),
  output_tokens = ROUND(tokens_used * 0.3),
  -- Haiku: $0.80/1M input + $4/1M output
  estimated_cost_usd = ROUND(
    (tokens_used * 0.7 / 1000000.0 * 0.80) +
    (tokens_used * 0.3 / 1000000.0 * 4.00),
    6
  )
WHERE model_used IS NULL;


-- ────────────────────────────────────────────────────────────────
-- Convenience view: per-user cost summary (used by /api/admin/usage)
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW admin_user_cost_summary AS
SELECT
  u.id                                                        AS user_id,
  u.email,
  u.full_name,
  u.allowed_model,
  u.model_label,

  -- Generation counts
  COUNT(DISTINCT g.id)                                        AS total_generations,
  COUNT(DISTINCT c.id) FILTER (WHERE c.cv_type = 'base')     AS total_base_cvs,
  COUNT(DISTINCT c.id) FILTER (WHERE c.cv_type = 'generated') AS total_generated_cvs,

  -- Token & cost totals
  COALESCE(SUM(l.input_tokens),  0)                          AS total_input_tokens,
  COALESCE(SUM(l.output_tokens), 0)                          AS total_output_tokens,
  COALESCE(SUM(l.input_tokens + l.output_tokens), 0)         AS total_tokens,
  COALESCE(ROUND(SUM(l.estimated_cost_usd)::numeric, 4), 0)  AS total_cost_usd,

  -- Savings (what would have been spent without the library)
  COALESCE(SUM(l.api_calls_saved), 0)                        AS total_api_calls_saved,

  -- Strategy breakdown
  COUNT(l.id) FILTER (WHERE l.strategy = 'library_only')     AS gens_library_only,
  COUNT(l.id) FILTER (WHERE l.strategy = 'library_plus_api') AS gens_library_plus_api,
  COUNT(l.id) FILTER (WHERE l.strategy = 'full_api')         AS gens_full_api,

  -- Avg library coverage
  COALESCE(ROUND(AVG(l.coverage_pct)::numeric * 100, 1), 0)  AS avg_coverage_pct,

  -- Last activity
  MAX(g.created_at)                                           AS last_generation_at,
  u.created_at                                                AS joined_at

FROM users u
LEFT JOIN cv_generations g  ON g.user_id = u.id
LEFT JOIN cvs c             ON c.user_id = u.id
LEFT JOIN cv_assembly_log l ON l.user_id = u.id
GROUP BY u.id, u.email, u.full_name, u.allowed_model, u.model_label, u.created_at
ORDER BY total_cost_usd DESC;


-- ────────────────────────────────────────────────────────────────
-- Pricing reference table (read-only, updated manually when Anthropic changes prices)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS model_pricing (
  model_id              VARCHAR(60)   PRIMARY KEY,
  label                 VARCHAR(60)   NOT NULL,
  input_cost_per_1m     NUMERIC(8,4)  NOT NULL,   -- USD per 1M input tokens
  output_cost_per_1m    NUMERIC(8,4)  NOT NULL,   -- USD per 1M output tokens
  effective_from        DATE          DEFAULT CURRENT_DATE,
  notes                 TEXT
);

INSERT INTO model_pricing (model_id, label, input_cost_per_1m, output_cost_per_1m, notes)
VALUES
  ('claude-haiku-4-5-20251001', 'Claude Haiku 4.5',   0.80,  4.00, 'Fastest, lowest cost'),
  ('claude-sonnet-4-6',         'Claude Sonnet 4.6',  3.00, 15.00, 'Balanced quality/cost'),
  ('claude-opus-4-6',           'Claude Opus 4.6',   15.00, 75.00, 'Highest quality')
ON CONFLICT (model_id) DO UPDATE
  SET input_cost_per_1m  = EXCLUDED.input_cost_per_1m,
      output_cost_per_1m = EXCLUDED.output_cost_per_1m,
      notes              = EXCLUDED.notes;
