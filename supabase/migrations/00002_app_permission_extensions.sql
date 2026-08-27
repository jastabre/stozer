-- STOZER App Permission Extensions (Phase 2)
-- ONLY enum extension + role_permissions seeds. No table code here.
-- Extends the app_permission enum with Phase 2 permission values.
-- See migration 00003_club_core.sql for the tables that use these.

-- ============================================================
-- ENUM EXTENSION
-- ============================================================

ALTER TYPE app_permission ADD VALUE IF NOT EXISTS 'seasons.view';
ALTER TYPE app_permission ADD VALUE IF NOT EXISTS 'seasons.manage';
ALTER TYPE app_permission ADD VALUE IF NOT EXISTS 'equipment.view';
ALTER TYPE app_permission ADD VALUE IF NOT EXISTS 'equipment.report';
ALTER TYPE app_permission ADD VALUE IF NOT EXISTS 'equipment.manage';
ALTER TYPE app_permission ADD VALUE IF NOT EXISTS 'medical.view';

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
