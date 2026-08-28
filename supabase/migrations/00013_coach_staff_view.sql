-- STOZER Coach self-profile visibility (WR-03 fix)
-- The staff.ts coach self-scope (applyViewerScope narrows the query to the
-- viewer's own linked profile) was dead code because the call sites pass
-- OrganizationContext (property `userRole`), and coaches never had staff.view
-- (00001 seeds) — so the staff_select RLS policy returned an empty set for
-- them even though the intended behavior (documented in staff.ts) is "a coach
-- receives only their linked profile".
--
-- Granting staff.view keeps the RLS boundary intact (org-scoped read of staff
-- rows) while letting the app-level self-scope actually reach the coach's own
-- profile. The applyViewerScope query.eq("user_id", viewer.userId) is what
-- narrows a coach to their own profile; the org + permission RLS boundary
-- still applies to every row.
INSERT INTO role_permissions (role, permission)
SELECT 'coach', 'staff.view'::app_permission
ON CONFLICT (role, permission) DO NOTHING;