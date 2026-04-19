-- CV Pilot Database Schema
-- Paste this into Supabase SQL Editor to set up the database

-- ════════════════════════════════════════════════════════════════
-- USERS TABLE (extends Supabase auth.users)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  role VARCHAR(20) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

-- ════════════════════════════════════════════════════════════════
-- CVS TABLE
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS cvs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  filename VARCHAR(255) NOT NULL,
  file_path VARCHAR(500),
  file_size_bytes INT,

  role_title VARCHAR(255),
  seniority VARCHAR(50),
  industry VARCHAR(100),

  cv_type VARCHAR(50) DEFAULT 'base',

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cvs_user_id ON cvs(user_id);
CREATE INDEX IF NOT EXISTS idx_cvs_cv_type ON cvs(cv_type);
CREATE INDEX IF NOT EXISTS idx_cvs_deleted_at ON cvs(deleted_at);

-- ════════════════════════════════════════════════════════════════
-- JOB DESCRIPTIONS TABLE
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS job_descriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  full_text TEXT NOT NULL,
  role_title VARCHAR(255),
  company_name VARCHAR(255),
  industry VARCHAR(100),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_jds_user_id ON job_descriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_jds_deleted_at ON job_descriptions(deleted_at);

-- ════════════════════════════════════════════════════════════════
-- CV GENERATIONS TABLE
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS cv_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  jd_id UUID NOT NULL REFERENCES job_descriptions(id),
  base_cv_ids UUID[] NOT NULL,
  template_cv_id UUID REFERENCES cvs(id),

  generated_cv_id UUID REFERENCES cvs(id) ON DELETE SET NULL,
  generated_cv_file_path VARCHAR(500),

  status VARCHAR(50) DEFAULT 'pending',
  error_message TEXT,
  processing_time_ms INT,
  updated_at TIMESTAMP DEFAULT NOW(),

  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_generations_user_id ON cv_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_status ON cv_generations(status);
CREATE INDEX IF NOT EXISTS idx_generations_created_at ON cv_generations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generations_deleted_at ON cv_generations(deleted_at);

-- ════════════════════════════════════════════════════════════════
-- ACTIVITY LOGS TABLE
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  action_type VARCHAR(50),
  description TEXT,
  metadata JSONB,

  ip_address INET,
  success BOOLEAN DEFAULT true,
  error_message TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_action ON activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_activity_created_at ON activity_logs(created_at DESC);

-- ════════════════════════════════════════════════════════════════
-- CV MODIFICATIONS TABLE
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS cv_modifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id UUID NOT NULL REFERENCES cv_generations(id),

  original_section VARCHAR(100),
  original_text TEXT,
  enhanced_text TEXT,
  change_type VARCHAR(50),

  similarity_score FLOAT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_modifications_generation_id ON cv_modifications(generation_id);

-- ════════════════════════════════════════════════════════════════
-- ADMIN ALERTS TABLE
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS admin_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  alert_type VARCHAR(50),
  user_id UUID REFERENCES users(id),
  action_id UUID,

  title VARCHAR(255),
  message TEXT,
  severity VARCHAR(50) DEFAULT 'info',

  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON admin_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_is_read ON admin_alerts(is_read);

-- ════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ════════════════════════════════════════════════════════════════

-- Enable RLS on all tables
ALTER TABLE cvs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_descriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cv_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own CVs
CREATE POLICY "Users can see own CVs"
  ON cvs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own CVs"
  ON cvs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own CVs"
  ON cvs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own CVs"
  ON cvs FOR DELETE
  USING (auth.uid() = user_id);

-- Users can only see their own JDs
CREATE POLICY "Users can see own JDs"
  ON job_descriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own JDs"
  ON job_descriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own JDs"
  ON job_descriptions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own JDs"
  ON job_descriptions FOR DELETE
  USING (auth.uid() = user_id);

-- Users can only see their own generations
CREATE POLICY "Users can see own generations"
  ON cv_generations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own generations"
  ON cv_generations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own generations"
  ON cv_generations FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can only see their own activity
CREATE POLICY "Users can see own activity"
  ON activity_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own activity"
  ON activity_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);
