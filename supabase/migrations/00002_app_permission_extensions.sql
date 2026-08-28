-- STOZER App Permission Extensions (Phase 2)
-- Enum extension only. No table code here.
-- Extends the app_permission enum with Phase 2 permission values.
-- See migration 00003_club_core.sql for the tables that use these.
--
-- The role_permissions seeds that USE these new values live in
-- 00010_app_permission_seeds.sql: PostgreSQL (SQLSTATE 55P04) forbids using a
-- value added via ALTER TYPE ... ADD VALUE in the same transaction that adds
-- it, and each supabase migration file executes in a single transaction.

-- ============================================================
-- ENUM EXTENSION
-- ============================================================

ALTER TYPE app_permission ADD VALUE IF NOT EXISTS 'seasons.view';
ALTER TYPE app_permission ADD VALUE IF NOT EXISTS 'seasons.manage';
ALTER TYPE app_permission ADD VALUE IF NOT EXISTS 'equipment.view';
ALTER TYPE app_permission ADD VALUE IF NOT EXISTS 'equipment.report';
ALTER TYPE app_permission ADD VALUE IF NOT EXISTS 'equipment.manage';
ALTER TYPE app_permission ADD VALUE IF NOT EXISTS 'medical.view';
