-- ════════════════════════════════════════════════════════════════
-- CV PILOT v2 — BULLET LIBRARY MIGRATION
-- Run this in Supabase SQL Editor AFTER running database_schema.sql
-- ════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────
-- TABLE: cv_bullet_library
-- Every bullet point / summary sentence from every CV ever uploaded
-- or generated is indexed here for fast reuse.
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cv_bullet_library (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cv_id           UUID        NOT NULL REFERENCES cvs(id)   ON DELETE CASCADE,

  -- The actual text of the bullet / sentence
  text            TEXT        NOT NULL,

  -- Where it came from in the CV structure
  section         VARCHAR(50) DEFAULT 'experience',
  -- values: 'summary' | 'experience' | 'skills' | 'education' | 'certifications'

  -- Skills / technologies detected in this bullet (keyword-extracted, no API)
  skills          TEXT[]      DEFAULT '{}',
  keywords        TEXT[]      DEFAULT '{}',

  -- Context about the role this bullet came from
  role_context    VARCHAR(255),   -- e.g. "Senior AWS Architect"
  company_context VARCHAR(255),   -- e.g. "Amazon"
  seniority       VARCHAR(50),    -- Junior | Mid | Senior | Lead | Principal

  -- Quality & usage tracking
  usage_count     INT         DEFAULT 0,
  last_used_at    TIMESTAMP,
  quality_score   FLOAT       DEFAULT 0.5,   -- 0.0 – 1.0, improved by user feedback

  created_at      TIMESTAMP   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bullet_lib_user     ON cv_bullet_library(user_id);
CREATE INDEX IF NOT EXISTS idx_bullet_lib_cv        ON cv_bullet_library(cv_id);
CREATE INDEX IF NOT EXISTS idx_bullet_lib_section   ON cv_bullet_library(section);
CREATE INDEX IF NOT EXISTS idx_bullet_lib_seniority ON cv_bullet_library(seniority);
-- GIN index lets Postgres do fast "array contains" queries on skills
CREATE INDEX IF NOT EXISTS idx_bullet_lib_skills    ON cv_bullet_library USING GIN(skills);
CREATE INDEX IF NOT EXISTS idx_bullet_lib_keywords  ON cv_bullet_library USING GIN(keywords);


-- ────────────────────────────────────────────────────────────────
-- TABLE: cv_assembly_log
-- Records every time a CV was assembled from the library,
-- so we can track what was reused vs. API-generated.
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cv_assembly_log (
  id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id       UUID    NOT NULL REFERENCES cv_generations(id) ON DELETE CASCADE,
  user_id             UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- How the generation was handled
  strategy            VARCHAR(30) NOT NULL,
  -- values: 'library_only' | 'library_plus_api' | 'full_api'

  -- Coverage metrics
  jd_skills_required  INT     DEFAULT 0,   -- total skills the JD asked for
  skills_from_library INT     DEFAULT 0,   -- how many were covered by library
  skills_from_api     INT     DEFAULT 0,   -- how many needed an API call
  coverage_pct        FLOAT   DEFAULT 0.0, -- skills_from_library / jd_skills_required

  -- Cost tracking
  api_calls_made      INT     DEFAULT 0,
  api_calls_saved     INT     DEFAULT 0,
  tokens_used         INT     DEFAULT 0,

  -- Bullet provenance — which library bullets were used
  bullet_ids_used     UUID[]  DEFAULT '{}',

  created_at          TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assembly_log_generation ON cv_assembly_log(generation_id);
CREATE INDEX IF NOT EXISTS idx_assembly_log_user        ON cv_assembly_log(user_id);
CREATE INDEX IF NOT EXISTS idx_assembly_log_strategy    ON cv_assembly_log(strategy);


-- ────────────────────────────────────────────────────────────────
-- RLS policies for new tables
-- ────────────────────────────────────────────────────────────────
ALTER TABLE cv_bullet_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE cv_assembly_log   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own bullets"
  ON cv_bullet_library FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own bullets"
  ON cv_bullet_library FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own bullets"
  ON cv_bullet_library FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users see own assembly logs"
  ON cv_assembly_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own assembly logs"
  ON cv_assembly_log FOR INSERT WITH CHECK (auth.uid() = user_id);


-- ────────────────────────────────────────────────────────────────
-- Helper view: admin can see library usage stats per user
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW admin_library_stats AS
SELECT
  u.email,
  COUNT(DISTINCT b.id)                                AS total_bullets,
  COUNT(DISTINCT b.cv_id)                             AS source_cvs,
  ROUND(AVG(b.usage_count)::numeric, 2)               AS avg_bullet_usage,
  SUM(l.api_calls_saved)                              AS total_api_calls_saved,
  ROUND(AVG(l.coverage_pct)::numeric * 100, 1)        AS avg_library_coverage_pct
FROM users u
LEFT JOIN cv_bullet_library b ON b.user_id = u.id
LEFT JOIN cv_assembly_log   l ON l.user_id = u.id
GROUP BY u.id, u.email
ORDER BY total_bullets DESC;
