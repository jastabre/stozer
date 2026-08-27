# Phase 2: Club & People - Research

**Researched:** 2026-08-27
**Domain:** Multi-tenant club data model — seasons, teams, athletes, registrations, staff, documents (Supabase Storage), medical exams, equipment, bulk CSV/XLSX import (Next.js 16 App Router)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (verbatim from 02-CONTEXT.md)

#### Season & Team Lifecycle
- **D-01:** Teams persist as records; athlete↔team membership is **seasonal** (a seasonal membership record links an athlete to a team for a given season). Matches brief §22 "permanent identity" + §57 "don't create a new athlete each year." — **Reversibility:** costly — [data model for membership history touches every team-member query and rollover logic]
- **D-02:** **Single active season** at a time. "Start New Season" deactivates the previous and activates a new one. Not multiple active seasons. — **Reversibility:** costly — [schema/business-logic supports only one active season; multi-active requires constraints change]
- **D-03:** **Guided rollover with review.** "Start New Season" copies teams/staff and lets the user move athletes between teams (U15→U17) in the flow, without creating new athletes. — **Reversibility:** reversible
- **D-04:** Past/inactive seasons are **archived and hidden from all default views**; the active season is the default. Past data is accessible through a simple season selector/filter. History is **not** a prominent standalone V1 feature; the athlete profile shows previous team/season memberships only in a secondary/collapsed area. — **Reversibility:** reversible

#### Player Identity & Athlete ID
- **D-05:** **Club athlete ID is auto-assigned** as a stable sequential number at athlete creation, used as the "poziv na broj" payment reference (brief §38). Never reassigned. — **Reversibility:** one-way — [payment references already issued to members/families depend on it; reassignment breaks reconciliation]
- **D-06:** **No generic `athlete_identifiers` table in V1.** Keep federation/external IDs out of the core athlete identity model. Provide only a simple optional free-text `Federation / Registration ID` field on the athlete profile (reference only). Stožer does **not** validate, interpret, or use this value anywhere, and it is **not** related to the club athlete ID. Future federation integrations get their own data model designed then. — **Reversibility:** reversible — [a future integration adds new tables; no existing data sacrificed]
- **D-07:** **Jersey number is separate from equipment sizing** and belongs to the athlete's current **team/season membership** (jersey numbers may change on team move or season change). — **Reversibility:** reversible
- **D-08:** Equipment handling in this phase covers **athlete equipment sizing and jersey-number data** and distinguishes **size-needed vs issued** (see Equipment section). Full inventory/procurement is out of scope. — **Reversibility:** reversible

#### Registration System & Status
- **D-09:** Registration is a **simple time-based record** (not strictly one record per athlete per season, and not a single mutable profile status). Each athlete can have registration records with: status, valid_from/start, valid_until/expiry, optional season association, optional document, and warning threshold. — **Reversibility:** reversible
- **D-10:** The athlete profile shows **only the current registration status by default**, derived from the active/latest record and its expiry date. Past records stay in the background for continuity but history is not a prominent V1 feature. — **Reversibility:** reversible
- **D-11:** Registrations are **not assumed to always be season-bound** (rules differ by sport, country, federation). — **Reversibility:** reversible
- **D-12:** Status is **auto-derived**: GREEN (active/registered), YELLOW (expiring within the configurable threshold), RED (expired or no active registration) — from expiry + a configurable **org-level default warning threshold** (e.g., 30 days) applied to registrations, documents, and licenses. — **Reversibility:** reversible

#### Bulk Player Import (REG-08)
- **D-13:** **Full wizard**: upload → column mapping → preview → validation → import. **Server-side processing** (Parsing + validation server-side for large clubs, e.g., 300+ players) with progress feedback. Matches brief §58. — **Reversibility:** reversible
- **D-14:** The **Team column validates against existing teams**; unknown team names are flagged as mapping/validation errors to fix before import (prevents accidental typo/duplicate teams). Teams are **not** auto-created from import. — **Reversibility:** reversible
- **D-15:** **Duplicate detection in preview**: match incoming rows against existing athletes by strong key (club athlete ID, or first+last+DOB fallback). Duplicates shown as warnings — user can skip, update existing, or create new. — **Reversibility:** reversible

#### Staff & User Accounts
- **D-16:** A **staff profile is separate from a login account**. Staff can exist as profiles without Stožer accounts (e.g., volunteers). Profile fields: name, photo, contact, title, teams, start/end, license(s), documents, notes. — **Reversibility:** costly — [separating staff-profile from auth affects invite flow and RBAC linking]
- **D-17:** When a staff member gets access, the club **links the profile to a user account and assigns an app role + teams** (coach sees own teams). No separate "staff role" enum — app roles + team assignment cover it. — **Reversibility:** reversible
- **D-18:** **Stožer licensing is organization-based, not per-seat.** A club buys one subscription and may create/link as many staff user accounts as needed without extra user licenses. User accounts exist for auth + permissions only; not separately billed. — **Reversibility:** one-way — [subscription/pricing model and any published plan limits depend on it]
- **D-19:** Track each coach's **professional/federation coaching license** on the staff profile (type, number, expiry, optional document), distinct from Stožer's own subscription licensing. Expiry alerts via the same green/yellow/red rule with the org warning threshold. — **Reversibility:** reversible

#### Guardians & Documents
- **D-20:** **Multiple guardians, one primary** per minor athlete (name, relationship, phone, email, preferred contact method). No parent portal in V1 (brief §16). — **Reversibility:** reversible
- **D-21:** Athlete documents stored in **Supabase Storage** (buckets scoped by organization for RLS isolation) with a **metadata row** in a documents table (type, filename, storage path, issued_at, expires_at, notes). Expiry alerts from metadata; downloads via signed URLs, permission-controlled, no public URLs. — **Reversibility:** costly — [storage-path convention and RLS policies underpin document access]
- **D-22:** **One org-scoped documents table, typed + linked to owner** (athlete or staff). Types: registration, contract, medical, insurance, identity, federation, custom. Serves athlete AND staff documents from one model; leaves room for club documents (Phase 6). — **Reversibility:** reversible

#### Equipment (dedicated operational area — whole-phase addition)
- **D-23:** A dedicated **Equipment menu/section**, visible only to users with equipment permissions — **permission-based, not role-bound** (a small club may have its president or secretary manage equipment). Keep permissions simple: **View equipment / Report needs/issues / Manage equipment**. — **Reversibility:** reversible
- **D-24:** Three primary areas: **1) Player Equipment, 2) Team/Training Equipment, 3) Equipment Requests.** Not a warehouse/ERP system. — **Reversibility:** reversible
- **D-25:** **Configurable equipment types** with sensible defaults: Match Kit (top, bottom), Tracksuit (top, bottom), Training Kit (shirt, shorts). Clubs can disable unused types and create custom types (jacket, hoodie, polo, GK kit, thermal kit, bag, etc.). A custom type allows single size or upper+lower sizes. Sizes support youth/adult presets plus custom values. — **Reversibility:** reversible
- **D-26:** Distinguish **(1) the size the athlete needs** from **(2) whether it has been issued.** States: Missing/Not issued, Issued, Returned, Lost, Damaged. Clubs indicate whether an equipment type is club property (to be returned) or athlete keeps it. Clubs can define required equipment per team/selection. — **Reversibility:** reversible
- **D-27:** **Player Equipment overview** (not per-profile): see at a glance who has all required equipment, who is missing equipment, what each athlete received, sizes, returned, lost/damaged. Provide counts/filters: Complete, Missing equipment, Not issued, Lost/damaged. A new/promoted athlete missing equipment automatically appears in "Missing equipment" — a persistent operational status, not a one-time notification. Optional small badge/count for unresolved items; avoid excessive push/email in V1. — **Reversibility:** reversible
- **D-28:** The **athlete profile shows only a concise equipment summary and sizes**; detailed issuing/returning/administration happens in the dedicated Equipment section. — **Reversibility:** reversible
- **D-29:** **Equipment export by team/selection** (for ordering): always includes surname, first name, current jersey number + selected equipment sizes + issued/missing status when relevant. User chooses which equipment types to include; can filter/export only athletes missing particular equipment. — **Reversibility:** reversible
- **D-30:** **Team/Training equipment: lightweight shared quantity tracking** (balls, cones, bibs, hurdles, ladders, pumps, medical bags, etc.) by quantity, not serial. Assigned to a team or a responsible staff member. Track issued, accounted-for, lost, damaged, returned, with simple season historical totals. **No** serial numbers, QR codes, or warehouse locations in V1. — **Reversibility:** reversible
- **D-31:** **Equipment Requests:** a simple workflow — team/selection, requested item, quantity, optional note, requester, date, status (**Requested / Approved / Purchased / Rejected**). Central view (Manage permission) of requests across all teams (what each team needs, what's approved, what still needs purchasing). — **Reversibility:** reversible
- **D-32:** **Equipment V1 boundary:** answers five questions — what equipment the club has; who/team has what; which athletes are missing required equipment; what has been lost/damaged; what equipment needs to be obtained. **No** full inventory/procurement ERP: no QR/barcode, serial-number tracking, multiple warehouses, supplier management, purchase orders, accounting, depreciation, or complex stock valuation. — **Reversibility:** reversible

#### Sports Medical Examinations (core V1 athlete requirement — whole-phase addition)
- **D-33:** **Structured per-athlete sports medical examination record** — separate from federation registration/licensing. Contains: examination date, valid_until/expiry date, derived current status, optional administrative note, optional attached certificate/document. — **Reversibility:** reversible
- **D-34:** Statuses: **Not recorded / Valid / Expiring soon / Expired.** — **Reversibility:** reversible
- **D-35:** **No hard-coded global validity duration.** Store the actual `valid_until` (validity differs by country, sport, federation, age group, competition). Country/sport-specific rules may later suggest validity — Stožer stays globally flexible. — **Reversibility:** reversible
- **D-36:** Medical expiry uses the **organization-level expiry-warning threshold** (same as registrations). Example: with a 30-day threshold, a medical becomes "Expiring soon" within 30 days of expiry. No medical-specific reminder configuration in V1. — **Reversibility:** reversible
- **D-37:** Show current administrative medical status clearly on the **athlete profile** ("Medical examination — Valid until 15 Oct 2026" / "Expiring in 12 days"). Past medical records remain in the background; history not prominent. — **Reversibility:** reversible
- **D-38:** Medical status visible at **team/selection level** with overview + filters (Valid / Expiring soon / Expired / Not recorded) — a coach must NOT have to open every athlete profile. — **Reversibility:** reversible
- **D-39:** Medical expiry/missing info participates in Stožer's **normal central alerts/expiry overview**. **No** separate top-level Medical menu in V1. — **Reversibility:** reversible
- **D-40:** **Registration and medical are separate concepts** — never combined into one database status (an athlete may be Registration: Valid / Medical: Expired). — **Reversibility:** reversible
- **D-41:** A medical certificate is an **optional attachment** to the structured record; the examination can be tracked without a file. Documents stored in private, permission-controlled storage — **no public URLs**. A coach may see that an athlete is Valid/Expired without permission to open the certificate. — **Reversibility:** reversible
- **D-42:** **Privacy — NOT a medical-record system.** Do not store diagnoses, examination findings, test results, medical history, or unnecessary health data. Only minimum administrative sports-clearance info: examination completed, examination date, valid-until date, administrative validity status, optional certificate. Access follows Stožer's role/permission system. — **Reversibility:** one-way — [storing health data later would require privacy/compliance rework; the safe boundary is set now]

### the agent's Discretion (verbatim from 02-CONTEXT.md)
- Team creation fields and defaults (name, sport, category per brief §12: first_team/youth/academy/other)
- Exact seed/RBAC preset permissions per app role for the new Phase 2 features (teams, athletes, registrations, documents, equipment, medical) — within the existing app_role/app_permission enum pattern
- Warning-threshold default value and configuration location (an org setting)
- CSV template design and which fields are required vs optional at import
- Equipment type seed data and size preset values
- Athlete profile field layout and which fields are required vs optional (per brief §22 core fields)
- Team/roster UI structure (list vs cards, consistent with Phase 1 app shell)

### Deferred Ideas (OUT OF SCOPE — verbatim from 02-CONTEXT.md)
- **Full athlete `athlete_identifiers` generic system / federation integrations** — deferred; current V1 uses only a simple optional free-text "Federation / Registration ID" field (D-06). Data model for actual federation integration (e.g., COMET) designed when an integration is built.
- **Parent portal / guardian accounts** — out of scope for V1 (brief §16); only guardian contact records captured here (D-20).
- **Detailed player development / athlete notes system** — deferred; brief §28; only internal notes possible later.
- **First-team finances, salaries, bonuses** — deferred to after V1 core (brief §25-26).
- **Advanced equipment: full inventory/procurement ERP** — out of Phase 2 scope (D-32). Preserves the broader equipment workflow (suppliers, purchasing, full asset tracking) for a later phase if the complete workflow extends beyond Phase 2; Phase 2 implements only the data structures needed now (athlete sizing/issue + lightweight shared tracking + requests).
- **Athlete notes module** — deferred; brief §28 (only simple internal notes; not a development system).
- **Player/team import of custom optional fields beyond the core mapping** — implementable but keep import to core fields; staff import noted as "later" in brief §58.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (from `.planning/REQUIREMENTS.md:24-44`) | Research Support |
|----|-------------|------------------|
| STRC-01 | Season management — create, activate, archive seasons | Partial unique index (Pattern 1); D-02/D-03/D-04; rollover copy transaction |
| STRC-02 | Team/selection management (Senior, U19, U17, U15, etc.) with sport abstraction | teams table + seasonal_memberships; D-01; team validation in import (D-14) |
| STRC-03 | Player profiles with permanent identity across seasons (name, DOB, nationality, position, status) | athletes table (permanent) + membership seasons; D-01/D-04; status helper |
| STRC-04 | Player equipment size (XS, S, M, L, XL, XXL, custom) and jersey number | athlete_equipment sizes (D-08/D-25/D-26); jersey on membership (D-07) |
| STRC-05 | Player club athlete ID — stable unique number used as payment reference (poziv na broj) | Counter column UPDATE..RETURNING (Pattern 3); D-05; unique (org, number) |
| STRC-06 | Staff/coach profiles (name, title, contact, teams, license, license expiration) | staff table separate from auth (D-16); link to user + app_role (D-17) |
| STRC-07 | Guardian contacts for minor players (name, relationship, phone, email, preferred contact method) | guardians table, multiple + one primary (D-20) |
| STRC-08 | Sport abstraction — football and basketball from day one, extensible to other sports | sport reference on teams/athletes (brief §12, agent discretion) |
| STRC-09 | Staff license expiry tracking with alerts | staff_licenses rows (D-19); shared status helper (D-12) |
| REG-01 | Player registration tracking (federation/system, registration identifier, status) | registrations table (D-09/D-11); federation ID free-text (D-06) |
| REG-02 | Registration start and expiry dates with configurable warning thresholds | valid_from/valid_until + org threshold (D-12); date-fns |
| REG-03 | Registration status visual indicators (green=registered, yellow=expiring soon, red=expired/not registered) | `deriveStatus()` shared helper (Code Examples) |
| REG-04 | Registration document upload and storage | documents + Storage RLS (D-21/D-22, Pattern 4) |
| REG-05 | Generic athlete identifier system for federation IDs (not hardcoded to COMET) | D-06 decision — V1 keeps optional free-text field only; no generic table |
| REG-06 | Basic player documents (medical, insurance, identity, custom types) with expiry tracking | typed documents table (D-22); signed URLs (D-21) |
| REG-07 | Expiration alerts for registrations and documents | shared status helper + org threshold (D-12/D-36) |
| REG-08 | CSV/XLSX player import with column mapping, validation, and preview | exceljs + csv-parse (Pattern 5); Zod schemas; dedupe (D-15); team validation (D-14) |
| REG-09 | Basic player contract tracking (type, status, start/end dates, document, expiry warning) | contracts table (existing enum perms) + documents linkage (D-22) |

</phase_requirements>

## Summary

Phase 2 builds the core domain layer of Stožer on the Phase 1 foundation (Supabase RLS schema with `app_role`/`app_permission` enums, `authorize()`, entitlements, Next 16 App Router with Server Actions, react-hook-form + Zod). The dominant engineering risks are (1) parsing untrusted user-uploaded CSV/XLSX files — the npm `xlsx` package is **frozen and unpatched** for two known CVEs, so `exceljs` + `csv-parse` are the correct parsers; (2) extending the Postgres `app_permission` enum — `ALTER TYPE ... ADD VALUE` cannot be used in the same transaction that adds it (error 55P04), so enum extension must be its own migration file; and (3) the single-active-season constraint — best enforced with a **partial unique index** (`WHERE is_active = true`) rather than triggers or manual checks.

Storage documents behind permission-controlled RLS (`storage.objects` policies scoping by `(storage.foldername(name))[1] = organization_id`), downloads via signed URLs only (max 7 days), never public URLs. The club athlete ID (D-05, "poziv na broj") is a per-organization counter maintained via an `UPDATE ... RETURNING` counter column — transactional and gapless. The import wizard runs server-side (D-13) with a <2 MB / ≤1 MB guidance file budget within Server Actions' configurable `bodySizeLimit`, using a dedicated endpoint + job-progress polling for large files.

**Primary recommendation:** Implement Phase 2 with Server Actions for mutations, `exceljs` + `csv-parse` for import parsing, `date-fns v4` for all date math, one shared green/yellow/red status helper, RLS on every new table with `authorize()`-based policies, and a separate enum-extension migration before schema migrations that reference new permissions.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Seed dumb structures (seasons, teams, equipment types) | Database / Storage | API / Backend | Schema + seeded reference rows; RLS-gated reads |
| Business identity (club athlete ID, status derivation) | Database / Storage | API / Backend | Counter via UPDATE..RETURNING; status computed from stored expiry dates |
| Import parsing & validation | API / Backend | Database / Storage | D-13 mandates server-side; exceljs/csv-parse run in Node route handler/action |
| Import wizard UI (upload/mapping/preview) | Browser / Client | API / Backend | RHF + Zod forms; calls server actions / route handlers |
| File storage & access control | Supabase Storage | Database / Storage (metadata rows) | Buckets + storage.objects RLS; signed URLs |
| Permissions & nav gating | Database / Storage (+ Frontend Server) | Browser / Client | app_permission + authorize(); nav via getNavConfig |
| Season rollover (guided copy) | API / Backend | Database / Storage | Server action transactional copy; partial unique index guards invariant |
| Document/medical/registration expiry alerts | API / Backend | Database / Storage | Shared helper over valid_until + org warning threshold |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| exceljs | ^4.4.0 [VERIFIED: npm registry via package-legitimacy OK] | XLSX read/write (streaming workbook.xlsx.read) | Only actively maintained XLSX lib; npm `xlsx` is CVE-frozen (see Pitfalls) |
| csv-parse | ^6.1 [VERIFIED: npm registry exists; 18.8M/wk] | Streaming CSV parsing with strict options | RFC4180 handling (BOM, quoted newlines) out of the box |
| date-fns | ^4.4.0 [ASSUMED: exact patch confirm at install] | Date math: age, expiry windows, formatting | Pure functions, tree-shakable, first-class tz via @date-fns/tz |
| @date-fns/tz | ^1.2 [VERIFIED: npm registry OK, 37M/wk] | Timezone-safe formatting | date-fns v4 timezone companion |
| @tanstack/react-table | ^8.2 [VERIFIED: npm registry exists] | Headless tables for roster/equipment overviews | Sort/filter/column-def API without DOM ownership; flag below |
| supabase-js (server client) | ^2.112.4 (installed) | DB + Storage operations in actions/handlers | Existing Phase 1 standard; storage API included |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zod | ^3.25.76 (installed) | Single source of truth for forms and import row validation | Every form + row schema reuses it |
| react-hook-form + @hookform/resolvers | ^7.86 / ^5.9 (installed) | Wizard + form state | Matching Phase 1 pattern |
| @supabase/ssr | ^0.12.5 (installed) | Auth/session | Already phase-1 standard |
| lucide-react | installed | Icons | Phase 1 standard |
| next-intl | ^4.13.7 (installed) | All new UI strings | Phase 1 standard |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| exceljs | npm `xlsx` (SheetJS CE) | `xlsx` frozen at 0.18.5, unpatched CVE-2023-30533 + CVE-2024-22363; exceljs actively maintained |
| exceljs | node-xlsx | node-xlsx is a thin SheetJS wrapper — inherits the CVEs |
| csv-parse | papaparse | papaparse is browser-first; csv-parse is Node streaming, better for server-side D-13 |
| date-fns | Temporal / @js-temporal/polyfill | Temporal Stage 4 (May 2026) but polyfill ~60KB; date-fns v4 is the pragmatic 2026 default |
| @tanstack/react-table | hand-rolled `<table>` + state | Re-sorting/filtering logic is exactly what TanStack Table exists to avoid |

**Installation:**
```bash
npm install exceljs csv-parse date-fns @date-fns/tz @tanstack/react-table
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom @testing-library/jest-dom vite-tsconfig-paths
```

**Version verification note:** `@tanstack/react-table`, `csv-parse`, vitest panel and `@testing-library/jest-dom` were flagged `SUS` (too-new / low-age heuristics) by the package-legitimacy seam; they are well-known canonical packages, so the planner must add a single `checkpoint:human-verify` before install per protocol rather than dropping them.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| exceljs | npm | ~3 yrs (2023-10-19) | 13.9M/wk | github.com/exceljs/exceljs | OK | Approved |
| @date-fns/tz | npm | 2026-05-21 | 37.4M/wk | github.com/date-fns/date-fns | OK | Approved |
| @testing-library/react | npm | mature | high | github.com/testing-library | OK | Approved |
| @testing-library/dom | npm | mature | high | github.com/testing-library | OK | Approved |
| vite-tsconfig-paths | npm | mature | high | github.com/aleclarson/vite-tsconfig-paths | OK | Approved |
| xlsx | npm | 2022-03-24 (frozen) | 12.5M/wk | github.com/SheetJS/sheetjs | OK | Approved — but **unpatched CVEs** → do NOT use (research override) |
| csv-parse | npm | 2026-08-02 | 18.8M/wk | github.com/adaltas/node-csv | SUS | Flagged — checkpoint:human-verify (too-new heuristic only) |
| @tanstack/react-table | npm | 2026-08 | high | github.com/TanStack/table | SUS | Flagged — checkpoint:human-verify (too-new heuristic only) |
| vitest | npm | 2026-08 | 96M/wk | github.com/vitest-dev/vitest | SUS | Flagged — checkpoint:human-verify (recommended by Next.js official docs) |
| @vitejs/plugin-react | npm | 2026-08 | high | github.com/vitejs | SUS | Flagged — checkpoint:human-verify |
| jsdom | npm | 2026-08 | 97M/wk | github.com/jsdom/jsdom | SUS | Flagged — checkpoint:human-verify |
| @testing-library/jest-dom | npm | 2026-08 | high | github.com/testing-library | SUS | Flagged — checkpoint:human-verify |
| date-fns | npm | (verify exact) | 25-30M/wk | github.com/date-fns/date-fns | OK (via @date-fns/tz check) | Approved |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** csv-parse, @tanstack/react-table, vitest, @vitejs/plugin-react, jsdom, @testing-library/jest-dom — planner inserts one `checkpoint:human-verify` before the dev-dependency install (and one before csv-parse/@tanstack/react-table).

**Research override (xlsx):** Registry verdict OK does not mean safe. SheetJS CE `xlsx@0.18.5` is the last npm publish; GitHub advisory: *"A non-vulnerable version cannot be found via npm"* for CVE-2023-30533 (prototype pollution, GHSA-4r6h-8v6p-xvw6) and CVE-2024-22363 (ReDoS); fix exists only at cdn.sheetjs.com (0.19.3). Importing untrusted files is precisely the vulnerable workflow. **[CITED: github.com/SheetJS/sheetjs#2822]**

## Architecture Patterns

### System Architecture Diagram

```
Browser (App Router [locale]/(dashboard))
  ├─ Wizard UI (/import) ──react-hook-form+zod──► Server Action: parse & validate rows
  │                                                 │ (route handler for large files + job row)
  │                                                 ▼
  │                                          [Import jobs table?] ──poll──► progress
  ▼
Server Actions / Route Handlers (Node runtime)
  ├─ exceljs / csv-parse ──► normalized rows ──► Zod row schema ──► dedupe (strong key)
  ├─ supabase server client ──► upsert athletes/memberships
  └─ storage.upload(path) ──► bucket /{org_id}/...
                │
Supabase (RLS on every table + storage.objects policies via authorize())
  ├─ seasons (partial unique index: one is_active per org)
  ├─ teams, athletes (club_athlete_number counter column), seasonal_memberships
  ├─ registrations / medical_examinations / documents / equipment_* / staff
  └─ Storage bucket: path rooted at {organization_id} — foldername()[1] scoping
```

### Recommended Project Structure
```
src/
├── app/[locale]/(dashboard)/
│   ├── teams/            # list + [id] roster (STRC-02)
│   ├── players/          # list, [id] profile, import wizard (STRC-03/05, REG-08)
│   ├── staff/            # list + [id] profile (STRC-06/09)
│   ├── equipment/        # overview, requests (D-23..D-32)
│   └── season/           # active season, "Start New Season" rollover (D-02/D-03)
├── components/…          # wizard steps, status badges, team roster table
├── lib/
│   ├── status.ts         # SHARED green/yellow/red derivation (D-12, REG-03, D-34)
│   ├── athlete-id.ts     # club athlete number format + counter (D-05)
│   ├── import/           # parsers (exceljs/csv-parse), row schemas, dedupe
│   └── storage.ts        # path builder, signed-URL helper
├── schemas/              # zod schemas incl. import columns
└── types/database.ts     # extend with Phase 2 table types
supabase/migrations/
├── 00002_app_permission_extensions.sql   # ALTER TYPE ADD VALUE ONLY (55P04!)
└── 00003_club_people.sql                 # tables + RLS + seeds (uses new values)
```

### Pattern 1: Single active season via partial unique index
**What:** `CREATE UNIQUE INDEX` with a `WHERE` predicate enforces one active season per organization at the constraint level.
**When to use:** D-02 (single active season); also 1-of-N invariants in equipment (one primary guardian per athlete — D-20).
**Example:**
```sql
-- Source: PostgreSQL official docs, Create Indexes / Example 11.3
CREATE UNIQUE INDEX tests_success_constraint ON tests (subject, target) WHERE success;
-- → STOZER
CREATE UNIQUE INDEX seasons_one_active_per_org
  ON seasons (organization_id) WHERE is_active = true;
```
Rollover (D-03) updates old row `is_active = false` and inserts new row in one transaction; the partial index only re-checks final row states — this works. **[CITED: postgresql.org/docs/current/indexes-partial.html]**

### Pattern 2: Enum extension must be its own migration
**What:** `ALTER TYPE ... ADD VALUE` runs inside a transaction in PG12+, but the new value cannot be *used* in the same transaction (error `55P04 "unsafe use of new value"`).
**When to use:** Any new `app_permission` (equipment.view, equipment.report, equipment.manage, medical.view, seasons.view/manage) or `app_role` value.
**Example:**
```sql
-- 00002 migration — ONLY this statement for new enum values
ALTER TYPE app_permission ADD VALUE IF NOT EXISTS 'equipment.view';
ALTER TYPE app_permission ADD VALUE IF NOT EXISTS 'equipment.report';
ALTER TYPE app_permission ADD VALUE IF NOT EXISTS 'equipment.manage';
ALTER TYPE app_permission ADD VALUE IF NOT EXISTS 'medical.view';
ALTER TYPE app_permission ADD VALUE IF NOT EXISTS 'seasons.view';
ALTER TYPE app_permission ADD VALUE IF NOT EXISTS 'seasons.manage';
-- 00003 migration (separate) may now reference 'equipment.manage' in role_permissions seeds
```
Exact existing values to extend (source of truth):
```sql
-- [VERIFIED: supabase/migrations/00001_foundation.sql:8-14]
CREATE TYPE app_role AS ENUM (
  'club_president', 'youth_director', 'coach', 'admin_finance', 'super_admin'
);
```
```sql
-- [VERIFIED: supabase/migrations/00001_foundation.sql:16-45] (app_permission — full list)
-- 'teams.view','teams.create','teams.edit','teams.delete','athletes.view','athletes.create',
-- 'athletes.edit','athletes.delete','athletes.view_sensitive','athletes.edit_sensitive',
-- 'attendance.manage','youth_finance.view','youth_finance.manage','first_team_finance.view',
-- 'first_team_finance.manage','registrations.view','registrations.manage','contracts.view',
-- 'contracts.manage','documents.view','documents.manage','sponsors.view','sponsors.manage',
-- 'staff.view','staff.manage','reports.view','reports.export','club_settings.manage',
-- 'notifications.manage'
```
Note: `seasons.*` is NOT in the existing enum (only in role_permissions seeds at lines 357-385 for teams/athletes/etc.), so season, equipment and medical permissions must be ADD VALUE'd. **[CITED: supabase migration best practice; PG error 55P04]**

### Pattern 3: Club athlete ID counter (transactional, gapless)
**What:** Per-organization contiguous number; DO NOT use `nextval` (leaves holes) or `MAX(id)+1` (race). Use a counter column on `organizations`, incremented inside the insert transaction.
**When to use:** D-05 (payment reference stability, never reassigned).
**Example:**
```sql
-- In the create-athlete server action's transaction:
UPDATE organizations
   SET club_athlete_counter = club_athlete_counter + 1
 WHERE id = $1
RETURNING club_athlete_counter;          -- → n; format client-side as 'C0001' (padded)
```
Then insert athlete with unique `(organization_id, club_athlete_number)`. Brief row lock is fine for club-scale concurrency. **[CITED: PostgreSQL docs — sequence functions & concurrency; research-store digest e16693…]**

### Pattern 4: Storage RLS scoping by org folder
**What:** One private bucket; object paths rooted at `{organization_id}/`; policies filter via `(storage.foldername(name))[1]`.
**When to use:** D-21/D-22 (athlete + staff documents, medical certificates), brief §62 paths `/{organization_id}/athletes/...`, `/club-documents/...`.
**Example:**
```sql
-- Source: https://supabase.com/docs/guides/storage/security/access-control
CREATE POLICY "Member insert own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'club-documents'
        AND (storage.foldername(name))[1] = (SELECT organization_id FROM profiles ...
));
```
Downloads: `supabase.storage.from('club-documents').createSignedUrl(path, 604800)` — max expiry 7 days; never `getPublicUrl` for private content. **[CITED: supabase.com/docs/guides/storage/security/access-control; supabase docs — createSignedUrl 604800s cap]**

### Pattern 5: Import wizard — server-side parse with progress
**What:** D-13 wizard: upload → column mapping → preview → validation → import. Files <1 MB fit Server Actions (default `serverActions.bodySizeLimit` = 1 MB, configurable); for larger files use a route handler + job-progress polling. **[VERIFIED: node_modules/next/dist/docs/01-app/02-guides/server-actions.md — default bodySizeLimit 1MB, sequential per-client dispatch, built-in CSRF]**
**Recommended:** set `serverActions.bodySizeLimit = '4mb'` in next.config.ts AND cap validated file size (reject >2 MB before parsing: FREE plan max_players=20 → real files are a few hundred KB). Parse → rows; validate Zod; dedupe by strong key (club athlete ID, else first+last+DOB — D-15); never auto-create teams (D-14).

### Anti-Patterns to Avoid
- **Importing with npm `xlsx`:** prototype-pollution CVE on untrusted uploads; unpatched on npm. Use exceljs.
- **Enum values + usage in one migration:** throws 55P04 on `ALTER TYPE ADD VALUE`. Separate migrations.
- **`getPublicUrl()` for documents/medical certificates:** exposes private data (D-21/D-41: no public URLs). Use signed URLs.
- **Hand-rolled green/yellow/red logic per page:** drift risk. One `lib/status.ts`.
- **Multiple active seasons:** partial unique index, not app-layer checks (two concurrent requests bypass app checks).
- **Jersey number on athlete table:** D-07 puts it on seasonal membership (changes with team/season).
- **Creating teams from import typos:** D-14 forbids auto-create; validate team column against existing teams.
- **Storing health data (diagnoses, findings):** D-42 — only `exam_date`, `valid_until`, derived status, admin note, optional certificate.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| XLSX parsing | Custom zip/XML parser | exceljs (streaming) | Binary format, sheet/type edge cases, active maintenance |
| CSV parsing | Split-on-comma parser | csv-parse (strict options) | Quoted commas, embedded newlines, BOM, encodings |
| Date math (age, expiry windows, DST) | Date arithmetic on ms | date-fns + @date-fns/tz | Timezones, month-length, leap-year edge cases |
| Table sorting/filtering | Hand-rolled sort state | @tanstack/react-table | Virtualization, column defs, a11y (flag above) |
| Signed URL generation | Custom HMAC signing | supabase-js `createSignedUrl` | Storage service owns signing + expiry; capped 7d |
| RBAC enforcement | Client-side role checks | RLS policies + `authorize()` (Phase 1) | Security must be DB-enforced; FORCE ROW LEVEL SECURITY |
| Migration of enum | Drop/recreate type | `ALTER TYPE ADD VALUE` in own migration | Enum values must never be removed |

**Key insight:** This phase is mostly *data modeling + secure file handling* — the dangerous parts are binary parsing, date math, and access control. All three have maintained libraries already in or beside the stack.

## Common Pitfalls

### Pitfall 1: CSV/XLSX prototype pollution & ReDoS via npm xlsx
**What goes wrong:** Importing untrusted uploads with `xlsx@0.18.5` triggers CVE-2023-30533 (prototype pollution) / CVE-2024-22363 (ReDoS). **Why:** SheetJS stopped publishing to npm; advisory says no non-vulnerable version on npm. **Avoid:** exceljs for XLSX; csv-parse `{ bom: true, skip_empty_lines: true, relax_column_count: false }` for CSV. **Warning signs:** package version 0.18.5, lib folder at `xlsx/` root.

### Pitfall 2: ALTER TYPE 55P04 in one migration
**What goes wrong:** `migration: down` / apply fails with `unsafe use of new value` when 0000X adds enum value and uses it. **Why:** PG forbids using a just-added enum value in the same transaction. **Avoid:** dedicated ADD VALUE migration first. **Warning signs:** migration contains both `ALTER TYPE ... ADD VALUE` and a later statement referencing that value.

### Pitfall 3: Server Actions 1MB body limit silently truncating imports
**What goes wrong:** Large XLSX/CSV upload fails with 413. **Why:** default `serverActions.bodySizeLimit` = 1 MB (in-repo verified). **Avoid:** raise to 4 MB + validate file size ≤2 MB with a clear user error; document-size guardrails. **Warning signs:** 413 on wizard step 1.

### Pitfall 4: Storage RLS on objects not applied → direct object URL leaks
**What goes wrong:** Anyone with a guessed path reads documents/medical certs. **Why:** `storage.objects` policies must be created explicitly (default deny). **Avoid:** `FORCE ROW LEVEL SECURITY`-style policies on objects scoped by `storage.foldername(name)[1]`; signed URLs only. **Warning signs:** `getPublicUrl` returns 200 for private content.

### Pitfall 5: Per-org number collisions
**What goes wrong:** Two concurrent inserts race → duplicate club athlete ID. **Why:** `MAX(id)+1` or app-level counters. **Avoid:** counter column `UPDATE ... RETURNING` inside the transaction; unique index `(organization_id, club_athlete_number)`. **Warning signs:** unique violations on athlete insert.

### Pitfall 6: Vitest can't test async Server Components
**What goes wrong:** Attempting to render an async server component in vitest fails/hangs. **Why:** React Server Components async rendering unsupported in vitest (in-repo doc). **Avoid:** unit-test sync components + pure libs (status, import validation, dedupe); keep wizard client/pure functions testable; E2E for async pages. **Warning signs:** `async` component direct render in tests.

## Code Examples

### Import parse (server side)
```ts
// exceljs streaming for XLSX (or csv-parse for .csv)
import { Workbook } from 'exceljs';
const wb = new Workbook();
await wb.xlsx.read(fileBuffer);                     // fileBuffer from Request formData
const rows = [] as Record<string, unknown>[];
wb.worksheets[0].eachRow((row, n) => {
  if (n === 1) return;                              // header row → column mapping
  rows.push(row.values.slice(1));                   // raw values for mapping step
});
```
```ts
import { parse } from 'csv-parse';
const records = await new Promise((res, rej) =>
  parse(fileBuffer, { columns: true, bom: true, skip_empty_lines: true, relax_column_count: false },
    (err, out) => (err ? rej(err) : res(out))));
```
*(Pattern: server action / route handler; Zod `safeParse` per row after column mapping; dedupe by strong key — D-15.)*

### Status helper (shared, D-12 / REG-03 / D-34)
```ts
export type StatusTone = 'green' | 'yellow' | 'red';
export function deriveStatus(validUntil: Date | null, thresholdDays: number, now = new Date()): StatusTone {
  if (!validUntil) return 'red';                                       // expired or none
  const daysLeft = differenceInCalendarDays(validUntil, now);
  if (daysLeft < 0) return 'red';
  if (daysLeft <= thresholdDays) return 'yellow';
  return 'green';
}
```

### Signed URL for documents (D-21)
```ts
const supabase = createServerSupabase();              // Phase 1 server client
const { data, error } = await supabase.storage
  .from('club-documents')
  .createSignedUrl(`${organizationId}/athletes/${athleteId}/${doc.storagePath}`, 604800);
// 604800 = 7 days — max allowed; returns { signedUrl }
```

### Club athlete ID creation (D-05)
```ts
// inside create-athlete transaction: generated id from counter RPC/update
const { data: counter } = await supabase.rpc('next_club_athlete_number', { p_org_id: organizationId });
const clubAthleteNumber = `C${String(counter).padStart(4, '0')}`;      // C0001
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| npm `xlsx` for spreadsheets | exceljs / csv-parse | 2022–2024 (SheetJS freeze + CVEs) | Must change parsers for Phase 2 |
| date-fns v3 / JS Date math | date-fns v4 + @date-fns/tz | 2024–2026 | First-class timezone, strict parsing |
| Temporal (pre-stage-4) | Temporal Stage 4 (May 2026), polyfill needed | May 2026 | Defer Temporal; date-fns remains default |
| seq-based numbering | counter column UPDATE RETURNING for per-org contiguous IDs | long-standing | Gapless payment refs satisfy D-05 |
| hard-coded validity durations | stored `valid_until` + derived status | D-35/D-36 | Global flexibility, per-country rules |

**Deprecated/outdated:**
- **`xlsx` (SheetJS CE npm):** frozen 0.18.5 (2022), unpatched CVEs; use exceljs.
- **`@supabase/ssr` old getSession flow:** not relevant — Phase 1 already uses the current middleware pattern.
- **Server Actions in Next <15:** bodySizeLimit now configurable (in-repo Next 16 docs); sequential per-client dispatch.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | date-fns exact patch ^4.4.0 (verified @date-fns/tz 37M/wk OK, date-fns patch number assumed) | Standard Stack | Low — any v4.x works; pin at install |
| A2 | exceljs streaming handles 300+ player sheets without OOM in Node runtime | Pattern 5 / Pitfalls | Low — memory-heap limits; fallback: csv-parse path |
| A3 | `createSignedUrl` 604800s hard cap (from Supabase docs search) | Pattern 4 | Low — cap is documented; shorter expiry acceptable if wrong |
| A4 | Wizard upload fits 4 MB bodySizeLimit for FREE plan (20 players) | Pattern 5 | Low — files are a few hundred KB; route-handler fallback exists |
| A5 | Threshold default 30 days chosen per D-12 example | Standard Stack/pitfalls | Low — org setting, configurable |

## Open Questions

1. **Storage bucket topology** — single `club-documents` bucket with org folders (recommended, matches `foldername()[1]` scoping + brief §62 paths) vs one bucket per org. Recommendation: single bucket + folder scoping; per-org buckets create RLS/management overhead for zero isolation gain.
2. **Import jobs table** — persistent `import_jobs` table (resumable, auditable) vs transient progress state (simpler). Recommendation: lightweight `import_jobs` row only for row counts/status — matches D-13 progress feedback and enables retry.
3. **Equipment permission granularity** — D-23 minimal: `equipment.view` + `equipment.report` + `equipment.manage` (recommended) vs single `equipment.manage`. Recommendation: three values as D-23 wording.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js runtime | ✓ | v24.14.0 | — |
| npm | installs | ✓ | 11.9.0 | — |
| Supabase CLI | migration apply / supabase status | ✗ | — | `npx supabase@latest` on demand, or Dashboard SQL editor; planner: add optional install step |
| Docker | local Supabase | ✗ | — | remote shared Supabase project (no local emulator) |
| Remote Supabase | RLS/storage/auth | ✓ (assumed via phase 1) | — | — |
| git | workflow | ✓ | — | — |

**Missing dependencies with no fallback:** none (CLI is installable via npx; Docker optional since phase 1 already targets remote Supabase).
**Missing dependencies with fallback:** Supabase CLI (`npx supabase link && npx supabase db push`), Docker (remote project).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest + @vitejs/plugin-react + jsdom + @testing-library/react + @testing-library/dom + vite-tsconfig-paths **[CITED: node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md]** |
| Config file | `vitest.config.ts` (create in Wave 0: `defineConfig({ plugins: [react()], test: { environment: 'jsdom', setupFiles: ['./vitest.setup.ts'] }, resolve: tsconfigPaths() })`) |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run --coverage` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REG-01/03 | registration status derivation (green/yellow/red) | unit | `npx vitest run src/lib/__tests__/status.test.ts` | ❌ Wave 0 |
| REG-02 | warning-threshold boundary (day == threshold → yellow) | unit | same file | ❌ Wave 0 |
| REG-08 | import row validation + dedupe strong-key | unit | `npx vitest run src/lib/import/__tests__/rows.test.ts` | ❌ Wave 0 |
| REG-08 | column mapping / preview sync components | unit (component) | `npx vitest run src/components/import/__tests__/mapping.test.tsx` | ❌ Wave 0 |
| STRC-05 | club athlete ID counter uniqueness/format | unit | `src/lib/__tests__/athlete-id.test.ts` | ❌ Wave 0 |
| D-03 | rollover copy logic (pure fn) | unit | `src/lib/__tests__/rollover.test.ts` | ❌ Wave 0 |
| D-20 | guardian primary uniqueness helper | unit | `src/lib/__tests__/guardian.test.ts` | ❌ Wave 0 |
| Storage/RLS | SQL policies (no local DB) | manual/SQL review | reviewer verifies policies against authorize() pattern | ❌ Wave 0 |
| Async pages | server components + exports | E2E/manual | vitest does NOT support async RSC **[VERIFIED: in-repo vitest.md]** | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run --coverage`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` + `vitest.setup.ts` — framework config
- [ ] `npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom @testing-library/jest-dom vite-tsconfig-paths` (checkpoint:human-verify first)
- [ ] `src/lib/__tests__/status.test.ts` — covers REG-01/02/03
- [ ] `src/lib/import/__tests__/rows.test.ts` — covers REG-08
- [ ] `src/lib/__tests__/athlete-id.test.ts` — covers STRC-05

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (Phase 1 handles) | Supabase Auth + @supabase/ssr existing |
| V3 Session Management | no (Phase 1 handles) | existing middleware pattern |
| V4 Access Control | yes | RLS on every new table + `authorize()`; storage.objects policies; new app_permission values seeded to role_permissions |
| V5 Input Validation | yes | Zod single source of truth for forms AND import rows; file size/type checks |
| V6 Cryptography | no custom crypto | platform TLS/S3 SSE; signed URLs from Supabase |

### Known Threat Patterns for Supabase/Next stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prototype pollution via .xlsx | Tampering | exceljs instead of npm xlsx (CVE-2023-30533) |
| Formula injection (`=cmd()`) in parsed cells | Tampering | treat imported values as data — never evaluate; escape on re-export; csv-parse `relax_column_count` strict |
| Object-URL guessing (IDOR) | Information Disclosure | storage.objects RLS via foldername()[1]; signed URLs ≤7d; never getPublicUrl |
| Enum/migration poisoning | Tampering | dedicated ALTER TYPE migration (55P04 guard proves ordering) |
| Mass assignment via action args | Elevation | Zod `pick`/`omit`; org_id always from session/`requireOrganization()`, never from client |
| 413 DoS via oversized upload | DoS | bodySizeLimit '4mb' + reject >2 MB with user error |

## Sources

### Primary (HIGH confidence)
- [Registry verify via package-legitimacy seam + `npm view` equivalents] — exceljs, csv-parse, @date-fns/tz, jsdom, vitest, xlsx, @testing-library/*
- [Official Postgres docs] — partial unique indexes (Example 11.3): postgresql.org/docs/current/indexes-partial.html
- [Supabase official docs] — storage access control & folder scoping: supabase.com/docs/guides/storage/security/access-control
- [In-repo Next 16 docs (Read this session)] — `node_modules/next/dist/docs/01-app/02-guides/server-actions.md` (bodySizeLimit 1MB default, CSRF, sequential dispatch); `.../testing/vitest.md` (devdeps + no-async-RSC); `.../01-next-config-js/serverExternalPackages.md` (exceljs needs explicit external entry)

### Secondary (MEDIUM confidence)
- [GitHub advisory + SheetJS issue #2822] — xlsx npm unpatched CVEs
- [Supabase migration best practices] — ALTER TYPE ADD VALUE in own migration
- [DBOS blog / community] — server-action job + progress polling pattern

### Tertiary (LOW confidence)
- WebSearch claims flagged in Assumptions Log (A1–A5)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH (registry-verified) — SUS flags routed to checkpoints
- Architecture: HIGH (in-repo docs + official Postgres/Supabase sources)
- Pitfalls: HIGH (CVE + 55P04 + 1MB limit are concrete, sourced)
- Import/date specifics: MEDIUM (works, but exact patch versions + wizard sizing assumed)

**Research date:** 2026-08-27
**Valid until:** 2026-09-26 (stable domain; re-check parser CVEs + Next docs before Phase 3)