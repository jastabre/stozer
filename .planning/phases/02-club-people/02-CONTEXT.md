# Phase 2: Club & People - Context

**Gathered:** 2026-08-27
**Status:** Ready for planning

<domain>
## Phase Boundary

The core domain model of Stožer: seasons, teams/selections, players with permanent identity, staff, guardians, registration tracking with expiry alerts, athlete documents and medical examinations, and bulk player import. This is the data foundation every later phase (scheduling, youth finance, dashboard) depends on. It establishes how a club structures its people and how status (registration, medical, license) is derived and surfaced.

</domain>

<decisions>
## Implementation Decisions

### Season & Team Lifecycle
- **D-01:** Teams persist as records; athlete↔team membership is **seasonal** (a seasonal membership record links an athlete to a team for a given season). Matches brief §22 "permanent identity" + §57 "don't create a new athlete each year." — **Reversibility:** costly — [data model for membership history touches every team-member query and rollover logic]
- **D-02:** **Single active season** at a time. "Start New Season" deactivates the previous and activates a new one. Not multiple active seasons. — **Reversibility:** costly — [schema/business-logic supports only one active season; multi-active requires constraints change]
- **D-03:** **Guided rollover with review.** "Start New Season" copies teams/staff and lets the user move athletes between teams (U15→U17) in the flow, without creating new athletes. — **Reversibility:** reversible
- **D-04:** Past/inactive seasons are **archived and hidden from all default views**; the active season is the default. Past data is accessible through a simple season selector/filter. History is **not** a prominent standalone V1 feature; the athlete profile shows previous team/season memberships only in a secondary/collapsed area. — **Reversibility:** reversible

### Player Identity & Athlete ID
- **D-05:** **Club athlete ID is auto-assigned** as a stable sequential number at athlete creation, used as the "poziv na broj" payment reference (brief §38). Never reassigned. — **Reversibility:** one-way — [payment references already issued to members/families depend on it; reassignment breaks reconciliation]
- **D-06:** **No generic `athlete_identifiers` table in V1.** Keep federation/external IDs out of the core athlete identity model. Provide only a simple optional free-text `Federation / Registration ID` field on the athlete profile (reference only). Stožer does **not** validate, interpret, or use this value anywhere, and it is **not** related to the club athlete ID. Future federation integrations get their own data model designed then. — **Reversibility:** reversible — [a future integration adds new tables; no existing data sacrificed]
- **D-07:** **Jersey number is separate from equipment sizing** and belongs to the athlete's current **team/season membership** (jersey numbers may change on team move or season change). — **Reversibility:** reversible
- **D-08:** Equipment handling in this phase covers **athlete equipment sizing and jersey-number data** and distinguishes **size-needed vs issued** (see Equipment section). Full inventory/procurement is out of scope. — **Reversibility:** reversible

### Registration System & Status
- **D-09:** Registration is a **simple time-based record** (not strictly one record per athlete per season, and not a single mutable profile status). Each athlete can have registration records with: status, valid_from/start, valid_until/expiry, optional season association, optional document, and warning threshold. — **Reversibility:** reversible
- **D-10:** The athlete profile shows **only the current registration status by default**, derived from the active/latest record and its expiry date. Past records stay in the background for continuity but history is not a prominent V1 feature. — **Reversibility:** reversible
- **D-11:** Registrations are **not assumed to always be season-bound** (rules differ by sport, country, federation). — **Reversibility:** reversible
- **D-12:** Status is **auto-derived**: GREEN (active/registered), YELLOW (expiring within the configurable threshold), RED (expired or no active registration) — from expiry + a configurable **org-level default warning threshold** (e.g., 30 days) applied to registrations, documents, and licenses. — **Reversibility:** reversible

### Bulk Player Import (REG-08)
- **D-13:** **Full wizard**: upload → column mapping → preview → validation → import. **Server-side processing** (Parsing + validation server-side for large clubs, e.g., 300+ players) with progress feedback. Matches brief §58. — **Reversibility:** reversible
- **D-14:** The **Team column validates against existing teams**; unknown team names are flagged as mapping/validation errors to fix before import (prevents accidental typo/duplicate teams). Teams are **not** auto-created from import. — **Reversibility:** reversible
- **D-15:** **Duplicate detection in preview**: match incoming rows against existing athletes by strong key (club athlete ID, or first+last+DOB fallback). Duplicates shown as warnings — user can skip, update existing, or create new. — **Reversibility:** reversible

### Staff & User Accounts
- **D-16:** A **staff profile is separate from a login account**. Staff can exist as profiles without Stožer accounts (e.g., volunteers). Profile fields: name, photo, contact, title, teams, start/end, license(s), documents, notes. — **Reversibility:** costly — [separating staff-profile from auth affects invite flow and RBAC linking]
- **D-17:** When a staff member gets access, the club **links the profile to a user account and assigns an app role + teams** (coach sees own teams). No separate "staff role" enum — app roles + team assignment cover it. — **Reversibility:** reversible
- **D-18:** **Stožer licensing is organization-based, not per-seat.** A club buys one subscription and may create/link as many staff user accounts as needed without extra user licenses. User accounts exist for auth + permissions only; not separately billed. — **Reversibility:** one-way — [subscription/pricing model and any published plan limits depend on it]
- **D-19:** Track each coach's **professional/federation coaching license** on the staff profile (type, number, expiry, optional document), distinct from Stožer's own subscription licensing. Expiry alerts via the same green/yellow/red rule with the org warning threshold. — **Reversibility:** reversible

### Guardians & Documents
- **D-20:** **Multiple guardians, one primary** per minor athlete (name, relationship, phone, email, preferred contact method). No parent portal in V1 (brief §16). — **Reversibility:** reversible
- **D-21:** Athlete documents stored in **Supabase Storage** (buckets scoped by organization for RLS isolation) with a **metadata row** in a documents table (type, filename, storage path, issued_at, expires_at, notes). Expiry alerts from metadata; downloads via signed URLs, permission-controlled, no public URLs. — **Reversibility:** costly — [storage-path convention and RLS policies underpin document access]
- **D-22:** **One org-scoped documents table, typed + linked to owner** (athlete or staff). Types: registration, contract, medical, insurance, identity, federation, custom. Serves athlete AND staff documents from one model; leaves room for club documents (Phase 6). — **Reversibility:** reversible

### Equipment (dedicated operational area — whole-phase addition)
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

### Sports Medical Examinations (core V1 athlete requirement — whole-phase addition)
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

### the agent's Discretion
- Team creation fields and defaults (name, sport, category per brief §12: first_team/youth/academy/other)
- Exact seed/RBAC preset permissions per app role for the new Phase 2 features (teams, athletes, registrations, documents, equipment, medical) — within the existing app_role/app_permission enum pattern
- Warning-threshold default value and configuration location (an org setting)
- CSV template design and which fields are required vs optional at import
- Equipment type seed data and size preset values
- Athlete profile field layout and which fields are required vs optional (per brief §22 core fields)
- Team/roster UI structure (list vs cards, consistent with Phase 1 app shell)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product Requirements
- `STOZER-BRIEF.md` — Product source of truth. Read: §12 (Sport abstraction), §13 (athlete identifiers), §15 (roles/permissions), §16 (parents/guardians), §21 (teams/selections), §22 (player), §23 (registration), §24 (contracts), §27 (athlete documents), §28 (athlete notes), §29 (staff), §57 (seasons), §58 (player import), §59 (database domains), §62 (file storage), §66 (empty states), §70 (engineering principles)
- `.planning/REQUIREMENTS.md` — Full requirement list. Phase 2 maps to: STRC-01..STRC-09 and REG-01..REG-09 (see items under "Club Structure" and "Player Administration")

### Technical Research
- `.planning/research/ARCHITECTURE.md` — Multi-tenant patterns, RBAC authorize(), RLS policies, storage patterns
- `.planning/research/STACK.md` — Tech stack choices and rationale
- `.planning/research/PITFALLS.md` — Known risks and mitigations
- `.planning/research/SUMMARY.md` — Research synthesis

### Project Context
- `.planning/PROJECT.md` — Project context, constraints, key decisions
- `.planning/ROADMAP.md` — 7-phase roadmap; Phase 2 success criteria
- `.planning/STATE.md` — Current project state

### Engineering Rules & Phase 1 Foundation
- `AGENTS.md` — Engineering workflow, security, financial correctness, testing, mobile, UI principles
- `.planning/phases/01-foundation/05-SUMMARY.md` — What Phase 1 built (client helpers, RLS schema, RBAC, i18n, entitlements, app shell)
- `.planning/phases/01-foundation/01-CONTEXT.md` — Phase 1 locked decisions (D-01..D-13) that still apply globally
- `supabase/migrations/00001_foundation.sql` — Existing schema: organizations, organization_memberships, roles, role_permissions, plans, plan_entitlements, subscriptions; app_role and app_permission enums (already include teams.*, athletes.*, registrations.*, contracts.*, documents.*, staff.*)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/organization.ts` — `requireOrganization()` / org context; new Phase 2 server actions/queries reuse this for tenant scoping
- `src/lib/rbac.ts` — Role-based nav configs; add Phase 2 nav items (Teams, Players, Staff, Equipment) per permission
- `src/lib/entitlements.ts` — Subscription entitlement checks; use for FREE-plan limits (e.g., player count) on new list/import gates
- `src/lib/supabase/{browser,server,middleware}.ts` — Supabase client helpers; server actions use the server client
- `src/components/layout/EmptyState.tsx` — Empty states for new sections (no teams/players yet)
- `src/components/layout/{Sidebar,BottomNav,NavItem}.tsx` — Nav components; new sections plug into `getNavConfig`
- `src/components/forms` pattern (react-hook-form + Zod) from `src/schemas/` — reuse for player/staff/team forms
- `src/i18n` (next-intl) + `messages/{sr,en}.json` — all new UI strings go through translations
- `src/types/database.ts` — Extend with new Phase 2 table types

### Established Patterns
- Server Components by default, Server Actions for mutations
- Zod + react-hook-form for all forms, Zod as single source of truth
- RLS on every table with FORCE ROW LEVEL SECURITY; org_id scoping on every row
- Role/permission model via `app_role` + `app_permission` enums + `role_permissions`
- i18n keys in `messages/{sr,en}.json`; `useTranslations()` in client components
- Grreen/yellow/red status derivation to be centralized (shared helper) for registrations/medical/license

### Integration Points
- Multi-tenant RLS (org_id) on all new tables (seasons, teams, athletes, memberships, staff, documents, registrations, medical, equipment)
- Nav (Sidebar/BottomNav) — add Phase 2 sections via `getNavConfig` + `app_permission` entries
- App routes under `src/app/[locale]/(dashboard)/` — new team/player/staff/equipment pages
- `app_permission` enum + `role_permissions` seed — add any new permissions (equipment.view/report/manage, medical.view) and preset mappings
- Supabase Storage — new private bucket for athlete/staff documents + medical certificates

</code_context>

<specifics>
## Specific Ideas

- "Poziv na broj" (payment reference) is the club athlete ID — this is the key that ties membership payments (Phase 4/5) to athletes, so its stability matters from the start.
- Medical validity must never be hard-coded globally — store real `valid_until` and derive status, because rules differ by country/sport/federation/age group.
- The Equipment area answers five operational questions and must stay simple — no ERP style complexity in V1; preserve the broader equipment requirements for the appropriate later phase.
- A new/promoted athlete who has not received required equipment should immediately appear in a persistent "Missing equipment" view — this is an operational status, not a one-time notification.
- The athlete profile must not be a wall of data: show current registration status, a concise equipment summary, and the current medical status, with history collapsed.

</specifics>

<deferred>
## Deferred Ideas

- **Full athlete `athlete_identifiers` generic system / federation integrations** — deferred; current V1 uses only a simple optional free-text "Federation / Registration ID" field (D-06). Data model for actual federation integration (e.g., COMET) designed when an integration is built.
- **Parent portal / guardian accounts** — out of scope for V1 (brief §16); only guardian contact records captured here (D-20).
- **Detailed player development / athlete notes system** — deferred; brief §28; only internal notes possible later.
- **First-team finances, salaries, bonuses** — deferred to after V1 core (brief §25-26).
- **Advanced equipment: full inventory/procurement ERP** — out of Phase 2 scope (D-32). Preserves the broader equipment workflow (suppliers, purchasing, full asset tracking) for a later phase if the complete workflow extends beyond Phase 2; Phase 2 implements only the data structures needed now (athlete sizing/issue + lightweight shared tracking + requests).
- **Athlete notes module** — deferred; brief §28 (only simple internal notes; not a development system).
- **Player/team import of custom optional fields beyond the core mapping** — implementable but keep import to core fields; staff import noted as "later" in brief §58.

</deferred>

---

*Phase: 2-Club & People*
*Context gathered: 2026-08-27*
