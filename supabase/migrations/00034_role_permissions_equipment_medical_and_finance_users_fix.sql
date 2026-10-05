-- 00034_role_permissions_equipment_medical_and_finance_users_fix.sql
--
-- Permission seeds for the new roles + separation of two overloaded
-- permissions. NON-DESTRUCTIVE: only role_permissions reference rows and role
-- display names are written; no user, membership, staff or domain data moves.
--
-- 1) FINANCE LOSES USER MANAGEMENT (root cause fix)
--    admin_finance was seeded club_settings.manage in 00001. That single
--    permission currently controls THREE unrelated things:
--      (a) organization_settings read/write     (00005 RLS)
--      (b) club branding + logo storage writes  (00025 RLS)
--      (c) the Klub -> Korisnici i pristup area + every role/account action
--    Finance has no legitimate need for (b)/(c), so the grant is removed and
--    (c) moves to the new, narrower `users.manage` permission (club_president
--    only). `club_settings.manage` keeps meaning "club configuration".
--    Migration 00035 also relaxes organization_settings SELECT to every org
--    member so the warning threshold keeps displaying for finance and coaches.
--
-- 2) MEDICAL WRITES GET THEIR OWN PERMISSION
--    medical_examinations writes rode registrations.manage (00005, D-38
--    shortcut). Writes now require `medical.manage`, granted to the roles that
--    actually enter medical records: club_president, youth_director and the
--    new medical_staff. Reads stay `registrations.view OR medical.view` so
--    registration/medical status stays visible where it already was.
--
-- 3) NEW ROLES
--    equipment_manager -> equipment module + basic athlete/team/staff read
--    medical_staff     -> medical module + basic athlete/team read
--    Neither gets a team scope: team scope is a coach-only concept (00035).

BEGIN;

-- ---------------------------------------------------------------
-- 1) Finance: out of user/access management and club settings
-- ---------------------------------------------------------------
DELETE FROM role_permissions
WHERE role = 'admin_finance'
  AND permission = 'club_settings.manage';

INSERT INTO role_permissions (role, permission) VALUES
  ('club_president', 'users.manage'),
  ('club_president', 'medical.manage'),
  ('youth_director', 'medical.manage')
ON CONFLICT (role, permission) DO NOTHING;

-- ---------------------------------------------------------------
-- 2) equipment_manager (Oprema)
--    Athlete roster is organization-wide: kit is issued for the whole club.
--    staff.view is required to resolve responsible/requester names in the
--    existing equipment module. No contracts/payments/medical/users/settings.
-- ---------------------------------------------------------------
INSERT INTO role_permissions (role, permission)
SELECT 'equipment_manager', unnest(ARRAY[
  'teams.view'::app_permission,
  'athletes.view'::app_permission,
  'staff.view'::app_permission,
  'seasons.view'::app_permission,
  'equipment.view'::app_permission,
  'equipment.report'::app_permission,
  'equipment.manage'::app_permission,
  'notifications.manage'::app_permission
])
ON CONFLICT (role, permission) DO NOTHING;

-- ---------------------------------------------------------------
-- 3) medical_staff (Medicinsko osoblje)
--    Medical examinations + the player/team context needed to work.
--    No registrations, no equipment, no payments, no users.
-- ---------------------------------------------------------------
INSERT INTO role_permissions (role, permission)
SELECT 'medical_staff', unnest(ARRAY[
  'teams.view'::app_permission,
  'athletes.view'::app_permission,
  'seasons.view'::app_permission,
  'medical.view'::app_permission,
  'medical.manage'::app_permission,
  'notifications.manage'::app_permission
])
ON CONFLICT (role, permission) DO NOTHING;

-- ---------------------------------------------------------------
-- 4) Role display names (roles is shared reference data, no RLS side effects)
-- ---------------------------------------------------------------
INSERT INTO roles (name, display_name) VALUES
  ('equipment_manager', 'Oprema'),
  ('medical_staff', 'Medicinsko osoblje')
ON CONFLICT (name) DO NOTHING;

COMMIT;
