-- 00046_app_permission_scheduling.sql
--
-- FORWARD-ONLY enum additions for Phase 3 (Scheduling & Attendance).
-- No consumers in this file: PostgreSQL (SQLSTATE 55P04) forbids using a value
-- added via ALTER TYPE ... ADD VALUE in the same transaction that adds it (the
-- same rule that split 00002/00010, 00033/00034 and 00044/00045). The
-- role_permissions seed lands in 00047; the tables/policies that reference
-- these values land in 00048/00049.
--
--   calendar.view    -> read the unified club calendar (trainings/matches/events)
--   venue.view       -> read the venue registry ("Tereni i lokacije")
--   venue.manage     -> create / edit / archive venues
--   match.view       -> read match records
--   match.manage     -> create / edit matches
--   attendance.view  -> read attendance statistics
--
-- Non-destructive: only new enum labels are appended; no table, row or
-- permission is touched.

ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'calendar.view';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'venue.view';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'venue.manage';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'match.view';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'match.manage';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'attendance.view';
