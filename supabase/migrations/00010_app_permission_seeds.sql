-- STOZER App Permission Seeds (Phase 2, 02-08 fix)
-- The role_permissions seeds originally authored in
-- 00002_app_permission_extensions.sql moved here so the new app_permission
-- enum values (added in 00002) are committed before they are used.
-- PostgreSQL (SQLSTATE 55P04) forbids using a value added via
-- ALTER TYPE ... ADD VALUE in the same transaction that adds it, and each
-- supabase migration file executes in a single transaction — so the seeds
-- cannot live in 00002.

-- ============================================================
-- SEED DATA: ROLE PERMISSIONS
-- ============================================================

-- Club President: seasons + medical + equipment (full scope)
INSERT INTO role_permissions (role, permission)
SELECT 'club_president', unnest(ARRAY[
  'seasons.view'::app_permission,
  'seasons.manage'::app_permission,
  'medical.view'::app_permission,
  'equipment.view'::app_permission,
  'equipment.report'::app_permission,
  'equipment.manage'::app_permission
])
ON CONFLICT (role, permission) DO NOTHING;

-- Youth Director: seasons + medical + equipment (full scope)
INSERT INTO role_permissions (role, permission)
SELECT 'youth_director', unnest(ARRAY[
  'seasons.view'::app_permission,
  'seasons.manage'::app_permission,
  'medical.view'::app_permission,
  'equipment.view'::app_permission,
  'equipment.report'::app_permission,
  'equipment.manage'::app_permission
])
ON CONFLICT (role, permission) DO NOTHING;

-- Coach: medical view + equipment view/report only
INSERT INTO role_permissions (role, permission)
SELECT 'coach', unnest(ARRAY[
  'medical.view'::app_permission,
  'equipment.view'::app_permission,
  'equipment.report'::app_permission
])
ON CONFLICT (role, permission) DO NOTHING;

-- Admin/Finance: equipment view/report only
INSERT INTO role_permissions (role, permission)
SELECT 'admin_finance', unnest(ARRAY[
  'equipment.view'::app_permission,
  'equipment.report'::app_permission
])
ON CONFLICT (role, permission) DO NOTHING;