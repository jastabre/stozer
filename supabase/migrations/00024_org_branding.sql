-- 00024_org_branding.sql
--
-- Club identity: logo and accent colors. DOCS-04/DOCS-05 — the club logo and
-- primary/secondary colors personalize the product; Stožer remains the
-- product brand. All new columns are optional; when unset the neutral default
-- theme is used. Colors are stored as hex (no alpha).

BEGIN;

ALTER TABLE organizations
  ADD COLUMN logo_url TEXT,
  ADD COLUMN primary_color TEXT,
  ADD COLUMN secondary_color TEXT;

-- Store colors as lower-case #rrggbb hex when present.
ALTER TABLE organizations
  ADD CONSTRAINT organizations_primary_color_check CHECK (
    primary_color IS NULL OR primary_color ~ '^#[0-9a-fA-F]{6}$'
  );
ALTER TABLE organizations
  ADD CONSTRAINT organizations_secondary_color_check CHECK (
    secondary_color IS NULL OR secondary_color ~ '^#[0-9a-fA-F]{6}$'
  );

COMMIT;