-- 00048_scheduling_core.sql
--
-- Phase 3 scheduling core: venues, trainings, training_coaches, attendance.
-- Same RLS discipline as 00001/00003: ENABLE + FORCE ROW LEVEL SECURITY on
-- every table, policies via public.authorize() + org scoping via the JWT
-- claim, and coach team scope via public.has_team_scope() /
-- public.has_athlete_scope() (helpers from 00035).
--
-- Consumes the app_permission values added in 00046 (seeded in 00047):
--   calendar.view      -> read trainings / training_coaches
--   venue.view         -> read venues
--   venue.manage       -> write venues
--   attendance.manage  -> write trainings / training_coaches / attendance
--   attendance.view    -> read attendance rows (statistics; consumed in 03-05)
--
-- NON-DESTRUCTIVE: new enums, tables, indexes and policies only. No existing
-- table, column or row is touched.

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE venue_type AS ENUM ('field', 'hall', 'balloon', 'other');
CREATE TYPE training_status AS ENUM ('scheduled', 'cancelled', 'completed');
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late');
CREATE TYPE absence_resolution AS ENUM ('unresolved', 'excused', 'unexcused');

-- ============================================================
-- TABLES
-- ============================================================

-- Venue registry (D-34..D-36): the club's own fields/halls/balloons.
CREATE TABLE venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  venue_type venue_type NOT NULL DEFAULT 'field',
  address TEXT,
  note TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Training: a structured calendar event (D-07..D-13). A recurring series is
-- expanded into one row per occurrence sharing series_id (D-11).
CREATE TABLE trainings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  venue_id UUID REFERENCES venues(id) ON DELETE SET NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER,
  note TEXT,
  status training_status NOT NULL DEFAULT 'scheduled',
  series_id UUID,
  recurrence_rule TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT trainings_time_order_check CHECK (ends_at > starts_at)
);

CREATE INDEX idx_trainings_team_starts ON trainings(team_id, starts_at);
CREATE INDEX idx_trainings_venue_starts ON trainings(venue_id, starts_at);

-- Training coaches (D-10): primary + assistant / goalkeeper / fitness, etc.
CREATE TABLE training_coaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  training_id UUID NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(training_id, staff_id)
);

-- Attendance (D-14..D-20): one row per athlete per training.
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  training_id UUID NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
  athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  status attendance_status NOT NULL DEFAULT 'present',
  absence_resolution absence_resolution NOT NULL DEFAULT 'unresolved',
  reason_preset TEXT,
  reason_note TEXT,
  recorded_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(training_id, athlete_id)
);

CREATE INDEX idx_attendance_training ON attendance(training_id);
CREATE INDEX idx_attendance_athlete ON attendance(athlete_id);

-- ============================================================
-- COMPOSITE ORGANIZATION KEYS
-- ============================================================

-- Composite organization keys prevent a caller from linking a row in this
-- domain to a parent record belonging to another organization. The ordinary
-- single-column foreign keys above preserve the normal delete behavior; these
-- constraints enforce tenant consistency at the database boundary as well.
ALTER TABLE venues ADD CONSTRAINT venues_id_organization_unique UNIQUE (id, organization_id);
ALTER TABLE trainings ADD CONSTRAINT trainings_id_organization_unique UNIQUE (id, organization_id);

ALTER TABLE trainings
  ADD CONSTRAINT trainings_team_org_fkey
  FOREIGN KEY (organization_id, team_id) REFERENCES teams(organization_id, id),
  ADD CONSTRAINT trainings_venue_org_fkey
  FOREIGN KEY (organization_id, venue_id) REFERENCES venues(organization_id, id);

ALTER TABLE training_coaches
  ADD CONSTRAINT training_coaches_training_org_fkey
  FOREIGN KEY (organization_id, training_id) REFERENCES trainings(organization_id, id),
  ADD CONSTRAINT training_coaches_staff_org_fkey
  FOREIGN KEY (organization_id, staff_id) REFERENCES staff(organization_id, id);

ALTER TABLE attendance
  ADD CONSTRAINT attendance_training_org_fkey
  FOREIGN KEY (organization_id, training_id) REFERENCES trainings(organization_id, id),
  ADD CONSTRAINT attendance_athlete_org_fkey
  FOREIGN KEY (organization_id, athlete_id) REFERENCES athletes(organization_id, id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainings ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

ALTER TABLE venues FORCE ROW LEVEL SECURITY;
ALTER TABLE trainings FORCE ROW LEVEL SECURITY;
ALTER TABLE training_coaches FORCE ROW LEVEL SECURITY;
ALTER TABLE attendance FORCE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- venues: read by venue.view; write by venue.manage (organization-wide).
CREATE POLICY "venues_select" ON venues
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('venue.view')
  );

CREATE POLICY "venues_insert" ON venues
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('venue.manage')
  );

CREATE POLICY "venues_update" ON venues
  FOR UPDATE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('venue.manage')
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('venue.manage')
  );

CREATE POLICY "venues_delete" ON venues
  FOR DELETE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('venue.manage')
  );

-- trainings: read by calendar.view (coach team-scoped); write by attendance.manage.
CREATE POLICY "trainings_select" ON trainings
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('calendar.view')
    AND (NOT public.is_team_scoped() OR public.has_team_scope(team_id))
  );

CREATE POLICY "trainings_insert" ON trainings
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('attendance.manage')
    AND (NOT public.is_team_scoped() OR public.has_team_scope(team_id))
  );

CREATE POLICY "trainings_update" ON trainings
  FOR UPDATE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('attendance.manage')
    AND (NOT public.is_team_scoped() OR public.has_team_scope(team_id))
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('attendance.manage')
    AND (NOT public.is_team_scoped() OR public.has_team_scope(team_id))
  );

CREATE POLICY "trainings_delete" ON trainings
  FOR DELETE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('attendance.manage')
    AND (NOT public.is_team_scoped() OR public.has_team_scope(team_id))
  );

-- training_coaches: read by calendar.view; write by attendance.manage.
-- Team scope is derived from the linked training (training_id -> trainings.team_id),
-- never from a client-supplied id: a coach may only touch rows whose training
-- belongs to an assigned team. Non-team-scoped roles stay organization-wide.
CREATE POLICY "training_coaches_select" ON training_coaches
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('calendar.view')
    AND (
      NOT public.is_team_scoped()
      OR EXISTS (
        SELECT 1 FROM public.trainings t
        WHERE t.id = training_id
          AND t.organization_id = training_coaches.organization_id
          AND public.has_team_scope(t.team_id)
      )
    )
  );

CREATE POLICY "training_coaches_insert" ON training_coaches
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('attendance.manage')
    AND (
      NOT public.is_team_scoped()
      OR EXISTS (
        SELECT 1 FROM public.trainings t
        WHERE t.id = training_id
          AND t.organization_id = training_coaches.organization_id
          AND public.has_team_scope(t.team_id)
      )
    )
  );

CREATE POLICY "training_coaches_update" ON training_coaches
  FOR UPDATE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('attendance.manage')
    AND (
      NOT public.is_team_scoped()
      OR EXISTS (
        SELECT 1 FROM public.trainings t
        WHERE t.id = training_id
          AND t.organization_id = training_coaches.organization_id
          AND public.has_team_scope(t.team_id)
      )
    )
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('attendance.manage')
    AND (
      NOT public.is_team_scoped()
      OR EXISTS (
        SELECT 1 FROM public.trainings t
        WHERE t.id = training_id
          AND t.organization_id = training_coaches.organization_id
          AND public.has_team_scope(t.team_id)
      )
    )
  );

CREATE POLICY "training_coaches_delete" ON training_coaches
  FOR DELETE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('attendance.manage')
    AND (
      NOT public.is_team_scoped()
      OR EXISTS (
        SELECT 1 FROM public.trainings t
        WHERE t.id = training_id
          AND t.organization_id = training_coaches.organization_id
          AND public.has_team_scope(t.team_id)
      )
    )
  );

-- attendance: read by attendance.view OR attendance.manage (coach athlete-scoped);
-- write by attendance.manage.
CREATE POLICY "attendance_select" ON attendance
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND (public.authorize('attendance.view') OR public.authorize('attendance.manage'))
    AND (NOT public.is_team_scoped() OR public.has_athlete_scope(athlete_id))
  );

CREATE POLICY "attendance_insert" ON attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('attendance.manage')
    AND (NOT public.is_team_scoped() OR public.has_athlete_scope(athlete_id))
  );

CREATE POLICY "attendance_update" ON attendance
  FOR UPDATE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('attendance.manage')
    AND (NOT public.is_team_scoped() OR public.has_athlete_scope(athlete_id))
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('attendance.manage')
    AND (NOT public.is_team_scoped() OR public.has_athlete_scope(athlete_id))
  );

CREATE POLICY "attendance_delete" ON attendance
  FOR DELETE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('attendance.manage')
    AND (NOT public.is_team_scoped() OR public.has_athlete_scope(athlete_id))
  );

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE TRIGGER venues_updated_at
  BEFORE UPDATE ON venues
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trainings_updated_at
  BEFORE UPDATE ON trainings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER attendance_updated_at
  BEFORE UPDATE ON attendance
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
