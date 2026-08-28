-- STOZER Cross-org parent-reference hardening (WR-05 fix)
-- Migration 00009 added composite (organization_id, parent_id) FKs for the
-- equipment domain ("prevent a caller from linking a row in this domain to a
-- parent record belonging to another organization"). The Phase-2 tables from
-- 00003/00005/00006/00007 still had only single-column FKs, so a caller with
-- the required permission could insert rows in their own org that reference
-- another org's parents (e.g. a registration tied to another org's season).
-- This migration closes that gap with the same composite-org-FK pattern.
--
-- The parent-side UNIQUE (id, organization_id) pairs this references were
-- already added by 00009 (teams_id_organization_unique, seasons_id_orga-
-- nization_unique, athletes_id_organization_unique, staff_id_organization_unique).

ALTER TABLE seasonal_memberships
  ADD CONSTRAINT seasonal_memberships_athlete_org_fkey
  FOREIGN KEY (organization_id, athlete_id) REFERENCES athletes(organization_id, id),
  ADD CONSTRAINT seasonal_memberships_season_org_fkey
  FOREIGN KEY (organization_id, season_id) REFERENCES seasons(organization_id, id),
  ADD CONSTRAINT seasonal_memberships_team_org_fkey
  FOREIGN KEY (organization_id, team_id) REFERENCES teams(organization_id, id);

ALTER TABLE guardians
  ADD CONSTRAINT guardians_athlete_org_fkey
  FOREIGN KEY (organization_id, athlete_id) REFERENCES athletes(organization_id, id);

ALTER TABLE staff_teams
  ADD CONSTRAINT staff_teams_staff_org_fkey
  FOREIGN KEY (organization_id, staff_id) REFERENCES staff(organization_id, id),
  ADD CONSTRAINT staff_teams_team_org_fkey
  FOREIGN KEY (organization_id, team_id) REFERENCES teams(organization_id, id),
  ADD CONSTRAINT staff_teams_season_org_fkey
  FOREIGN KEY (organization_id, season_id) REFERENCES seasons(organization_id, id);

ALTER TABLE staff_licenses
  ADD CONSTRAINT staff_licenses_staff_org_fkey
  FOREIGN KEY (organization_id, staff_id) REFERENCES staff(organization_id, id);

ALTER TABLE registrations
  ADD CONSTRAINT registrations_athlete_org_fkey
  FOREIGN KEY (organization_id, athlete_id) REFERENCES athletes(organization_id, id),
  ADD CONSTRAINT registrations_season_org_fkey
  FOREIGN KEY (organization_id, season_id) REFERENCES seasons(organization_id, id);

ALTER TABLE medical_examinations
  ADD CONSTRAINT medical_examinations_athlete_org_fkey
  FOREIGN KEY (organization_id, athlete_id) REFERENCES athletes(organization_id, id);

ALTER TABLE contracts
  ADD CONSTRAINT contracts_athlete_org_fkey
  FOREIGN KEY (organization_id, athlete_id) REFERENCES athletes(organization_id, id);