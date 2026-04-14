-- ════════════════════════════════════════════════════════════════
-- CV PILOT v5 — SUBMISSIONS TRACKER + JD METADATA + BULK JOBS
-- Run AFTER v4 migration.
-- ════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────
-- Extend job_descriptions with recruiter / client metadata
-- ────────────────────────────────────────────────────────────────
ALTER TABLE job_descriptions
  ADD COLUMN IF NOT EXISTS vendor_name   VARCHAR(255),
  ADD COLUMN IF NOT EXISTS client_name   VARCHAR(255),
  ADD COLUMN IF NOT EXISTS client_email  VARCHAR(255),
  ADD COLUMN IF NOT EXISTS jd_hash       VARCHAR(64),   -- SHA-256 for duplicate detection
  ADD COLUMN IF NOT EXISTS notes         TEXT;

-- Index for fast duplicate lookups
CREATE INDEX IF NOT EXISTS idx_jd_hash        ON job_descriptions(jd_hash);
CREATE INDEX IF NOT EXISTS idx_jd_client_email ON job_descriptions(client_email);

-- ────────────────────────────────────────────────────────────────
-- TABLE: submissions
-- One row per "CV sent to a client".
-- Auto-created when a CV generation succeeds.
-- Tracks the full lifecycle from generation → placement.
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS submissions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES users(id)            ON DELETE CASCADE,
  generation_id    UUID        REFERENCES cv_generations(id)            ON DELETE SET NULL,
  cv_id            UUID        REFERENCES cvs(id)                       ON DELETE SET NULL,
  jd_id            UUID        REFERENCES job_descriptions(id)          ON DELETE SET NULL,

  -- Candidate info (denormalised for quick display)
  candidate_name   VARCHAR(255),

  -- Client / vendor contact
  vendor_name      VARCHAR(255),
  client_name      VARCHAR(255),
  client_email     VARCHAR(255),

  -- Role info (from the JD)
  role_title       VARCHAR(255),

  -- Kanban status
  status           VARCHAR(30) NOT NULL DEFAULT 'to_submit',
  -- values: to_submit | submitted | reviewing | interview | offer | hired | rejected

  -- Free-text notes per submission
  notes            TEXT,

  -- Key dates
  submitted_at     TIMESTAMP,
  follow_up_at     TIMESTAMP,
  interview_at     TIMESTAMP,
  outcome_at       TIMESTAMP,

  created_at       TIMESTAMP   DEFAULT NOW(),
  updated_at       TIMESTAMP   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_submissions_user     ON submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status   ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_email    ON submissions(client_email);
CREATE INDEX IF NOT EXISTS idx_submissions_gen      ON submissions(generation_id);

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own submissions"
  ON submissions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own submissions"
  ON submissions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own submissions"
  ON submissions FOR UPDATE USING (auth.uid() = user_id);


-- ────────────────────────────────────────────────────────────────
-- TABLE: bulk_generation_jobs
-- Tracks a "one candidate, many JDs" batch run.
-- Each child generation is a standard cv_generations row tagged
-- with this bulk_job_id.
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bulk_generation_jobs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Candidate CVs used for all items in this batch
  base_cv_ids      UUID[]      NOT NULL DEFAULT '{}',
  template_cv_id   UUID        REFERENCES cvs(id) ON DELETE SET NULL,

  -- Progress
  total_count      INT         NOT NULL DEFAULT 0,
  completed_count  INT         NOT NULL DEFAULT 0,
  failed_count     INT         NOT NULL DEFAULT 0,
  status           VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- values: pending | processing | completed | partial_failure | failed

  created_at       TIMESTAMP   DEFAULT NOW(),
  completed_at     TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bulk_jobs_user ON bulk_generation_jobs(user_id);
ALTER TABLE bulk_generation_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own bulk jobs"    ON bulk_generation_jobs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own bulk jobs" ON bulk_generation_jobs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own bulk jobs" ON bulk_generation_jobs FOR UPDATE USING (auth.uid() = user_id);


-- ────────────────────────────────────────────────────────────────
-- Extend cv_generations to track bulk job membership
-- ────────────────────────────────────────────────────────────────
ALTER TABLE cv_generations
  ADD COLUMN IF NOT EXISTS bulk_job_id UUID REFERENCES bulk_generation_jobs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_gen_bulk_job ON cv_generations(bulk_job_id);


-- ────────────────────────────────────────────────────────────────
-- View: submission pipeline summary per user (for dashboard widget)
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW user_submission_pipeline AS
SELECT
  user_id,
  COUNT(*) FILTER (WHERE status = 'to_submit')  AS to_submit,
  COUNT(*) FILTER (WHERE status = 'submitted')  AS submitted,
  COUNT(*) FILTER (WHERE status = 'reviewing')  AS reviewing,
  COUNT(*) FILTER (WHERE status = 'interview')  AS interview,
  COUNT(*) FILTER (WHERE status = 'offer')      AS offer,
  COUNT(*) FILTER (WHERE status = 'hired')      AS hired,
  COUNT(*) FILTER (WHERE status = 'rejected')   AS rejected,
  COUNT(*)                                       AS total
FROM submissions
GROUP BY user_id;
