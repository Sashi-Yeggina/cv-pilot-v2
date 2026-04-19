-- ════════════════════════════════════════════════════════════════
-- CV PILOT — FULL CLEANUP SCRIPT
-- Run this in Supabase SQL Editor BEFORE running migrations 01–08
-- It drops everything in the correct dependency order.
-- ════════════════════════════════════════════════════════════════

-- ── 1. TRIGGERS ─────────────────────────────────────────────────
DROP TRIGGER IF EXISTS on_auth_user_created             ON auth.users;
DROP TRIGGER IF EXISTS update_cv_generations_updated_at ON cv_generations;
DROP TRIGGER IF EXISTS update_model_settings_updated_at ON model_settings;

-- ── 2. VIEWS ────────────────────────────────────────────────────
DROP VIEW IF EXISTS admin_user_cost_summary  CASCADE;
DROP VIEW IF EXISTS admin_library_stats      CASCADE;
DROP VIEW IF EXISTS user_submission_pipeline CASCADE;

-- ── 3. FUNCTIONS ────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.handle_new_user()          CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column()        CASCADE;
DROP FUNCTION IF EXISTS increment_bullet_usage(UUID)      CASCADE;

-- ── 4. POLICIES (drop so tables can be dropped cleanly) ─────────

-- cvs
DROP POLICY IF EXISTS "Users can see own CVs"    ON cvs;
DROP POLICY IF EXISTS "Users can insert own CVs" ON cvs;
DROP POLICY IF EXISTS "Users can update own CVs" ON cvs;
DROP POLICY IF EXISTS "Users can delete own CVs" ON cvs;

-- job_descriptions
DROP POLICY IF EXISTS "Users can see own JDs"    ON job_descriptions;
DROP POLICY IF EXISTS "Users can insert own JDs" ON job_descriptions;
DROP POLICY IF EXISTS "Users can update own JDs" ON job_descriptions;
DROP POLICY IF EXISTS "Users can delete own JDs" ON job_descriptions;

-- cv_generations
DROP POLICY IF EXISTS "Users can see own generations"    ON cv_generations;
DROP POLICY IF EXISTS "Users can insert own generations" ON cv_generations;
DROP POLICY IF EXISTS "Users can update own generations" ON cv_generations;

-- activity_logs
DROP POLICY IF EXISTS "Users can see own activity"    ON activity_logs;
DROP POLICY IF EXISTS "Users can insert own activity" ON activity_logs;

-- cv_bullet_library
DROP POLICY IF EXISTS "Users see own bullets"    ON cv_bullet_library;
DROP POLICY IF EXISTS "Users insert own bullets" ON cv_bullet_library;
DROP POLICY IF EXISTS "Users update own bullets" ON cv_bullet_library;

-- cv_assembly_log
DROP POLICY IF EXISTS "Users see own assembly logs"    ON cv_assembly_log;
DROP POLICY IF EXISTS "Users insert own assembly logs" ON cv_assembly_log;

-- bulk_generation_jobs
DROP POLICY IF EXISTS "Users see own bulk jobs"    ON bulk_generation_jobs;
DROP POLICY IF EXISTS "Users insert own bulk jobs" ON bulk_generation_jobs;
DROP POLICY IF EXISTS "Users update own bulk jobs" ON bulk_generation_jobs;

-- submissions
DROP POLICY IF EXISTS "Users see own submissions"    ON submissions;
DROP POLICY IF EXISTS "Users insert own submissions" ON submissions;
DROP POLICY IF EXISTS "Users update own submissions" ON submissions;

-- model_change_log
-- (RLS enabled but no named policies to drop)

-- ── 5. TABLES (leaf → root, respecting foreign keys) ─────────────

-- Cost / usage
DROP TABLE IF EXISTS user_model_usage    CASCADE;
DROP TABLE IF EXISTS model_pricing       CASCADE;

-- Model management
DROP TABLE IF EXISTS model_settings      CASCADE;
DROP TABLE IF EXISTS model_change_log    CASCADE;

-- Submissions & bulk jobs
DROP TABLE IF EXISTS submissions         CASCADE;
DROP TABLE IF EXISTS bulk_generation_jobs CASCADE;

-- CV assembly & modifications
DROP TABLE IF EXISTS cv_assembly_log     CASCADE;
DROP TABLE IF EXISTS cv_modifications    CASCADE;

-- Bullet library
DROP TABLE IF EXISTS cv_bullet_library   CASCADE;

-- Admin alerts
DROP TABLE IF EXISTS admin_alerts        CASCADE;

-- Activity
DROP TABLE IF EXISTS activity_logs       CASCADE;

-- Core pipeline (generations → cvs / job_descriptions → users)
DROP TABLE IF EXISTS cv_generations      CASCADE;
DROP TABLE IF EXISTS job_descriptions    CASCADE;
DROP TABLE IF EXISTS cvs                 CASCADE;

-- Users (last — everything else references this)
DROP TABLE IF EXISTS users               CASCADE;

-- ── 6. DONE ──────────────────────────────────────────────────────
-- All CV Pilot tables, views, functions, triggers and policies
-- have been removed. Run migrations 01 → 08 to rebuild fresh.
