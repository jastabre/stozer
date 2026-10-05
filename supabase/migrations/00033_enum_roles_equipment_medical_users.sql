-- 00033_enum_roles_equipment_medical_users.sql
--
-- FORWARD-ONLY enum additions. No consumers in this file: PostgreSQL
-- (SQLSTATE 55P04) forbids using a value added via ALTER TYPE ... ADD VALUE in
-- the same transaction that adds it, and each supabase migration file runs in
-- one transaction (same rule that split 00002/00010).
--
--   app_role:
--     equipment_manager -> "Oprema"          (kit manager)
--     medical_staff     -> "Medicinsko osoblje" (doctor / physiotherapist)
--
--   app_permission:
--     medical.manage -> write access to medical_examinations, separated from
--                       registrations.manage (which used to carry it)
--     users.manage   -> membership / role / account administration, separated
--                       from club_settings.manage (which used to carry it)
--
-- Non-destructive: only new enum labels are appended. No table is recreated,
-- no row is touched, existing memberships/staff/permissions stay valid.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'equipment_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'medical_staff';

ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'medical.manage';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'users.manage';
