-- 00044_staff_finance_permissions.sql
--
-- FORWARD-ONLY enum additions for staff finance. No consumers in this file:
-- PostgreSQL (SQLSTATE 55P04) forbids using a value added via
-- ALTER TYPE ... ADD VALUE in the same transaction that adds it (same rule
-- that split 00002/00010 and 00033/00034). The tables, policies and role
-- seeds that reference these values land in 00045.
--
--   staff_finance.view   -> read staff compensation / obligation / payment data
--   staff_finance.manage -> write staff compensation / obligations / payments
--
-- Mirrors the first_team_finance split (00022/00023): the same roles that
-- manage first-team finance also manage staff finance.

ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'staff_finance.view';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'staff_finance.manage';
