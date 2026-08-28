---
phase: 02
slug: club-people
status: verified
threats_open: 0
asvs_level: 1
created: 2026-08-28
---

# Phase 02 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| npm registry -> node_modules | Untrusted third-party code enters the build at install time | third-party packages |
| client -> server actions | Untrusted form data crosses into DB writes | profile/registration/contract/equipment data |
| JWT claim -> RLS scoping | Authorization rests on app_metadata.organization_id + user_role claims | identity claims |
| counter claim -> athletes.club_athlete_number | Race would mint duplicate payment references | athlete id |
| client upload -> storage.objects | Untrusted file bytes (size/type/content) enter private storage | documents, certificates |
| signed URL -> storage read | Download access delegated through short-lived URL | documents |
| storage path -> RLS foldername | Path convention is the org-isolation boundary | object keys |
| uploaded file -> parsers | Untrusted binary/text content enters the process | CSV/XLSX bytes |
| mapped cells -> DB writes | Imported values become athlete rows | athlete fields |
| polling client -> import actions | Batch mutation endpoints called repeatedly | import jobs |
| export builder -> CSV string | Injected formulas could execute in spreadsheet viewers | CSV export |
| nav config -> menu visibility | Section exposure must track permissions exactly | UI metadata |
| CLI token -> live Supabase project | Admin-level credential opens destructive operations | DB migrations |
| local migrations -> remote DB | Untested SQL executes against production data | SQL DDL/DML |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-02-01-01 | Tampering | npm package installs | high | mitigate | blocking-human package-legitimacy gate verifies [ASSUMED]/[SUS] packages on npmjs.com before install; [SLOP] forbidden (02-01-PLAN.md:16,80-85; package.json:22,24 — csv-parse/exceljs only) | closed |
| T-02-01-02 | Tampering | package.json / lockfile | low | accept | pinned ranges from RESEARCH.md; drifting transitive dep out of Phase 2 scope (02-01-PLAN.md:123) | closed (accepted) |
| T-02-02-01 | Elevation | createPlayer args | high | mitigate | zod schema whitelist (src/schemas/player.ts:8-29); organization_id from requireOrganization() (players/actions.ts:25); hasPermission('athletes.create') (players/actions.ts:28) | closed |
| T-02-02-02 | Spoofing | requireOrganization / RLS | high | mitigate | every table ENABLE + FORCE RLS; policies scope organization_id = JWT claim + authorize() (00003:98-101, 00005:84-86, 00006:87-90, 00007:97,99, 00008:38, 00009:137-141; src/lib/organization.ts:66) | closed |
| T-02-02-03 | Tampering | club_athlete_counter race | high | mitigate | UPDATE..RETURNING SECURITY DEFINER RPC, JWT org-guarded (00004:8-26,21-24); UNIQUE(organization_id, club_athlete_number) backstop (00003:62); call club-data.ts:642-643 | closed |
| T-02-02-04 | Tampering | double-active season | medium | mitigate | partial unique index one_active_season_per_org (00003:30); archive-before-activate + WR-01 compensating sequence (seasons/actions.ts:148-155,220-243) | closed |
| T-02-02-05 | Spoofing | seasons/teams/athletes org isolation | high | mitigate | FORCE RLS + org claim on every 00003..00009 policy; RPC org guard (00004:21-24); composite org FKs 00011:14-50 | closed |
| T-02-03-01 | Elevation | registration/medical write actions | high | mitigate | zod date validation (registrations/actions.ts:11-28, medical/actions.ts:13-28); requireOrganization()+hasPermission('registrations.manage') (:37-39) | closed |
| T-02-03-02 | Info Disclosure | medical_examinations RLS | high | mitigate | select = registrations.view OR medical.view + org claim (00005:148-153); write = registrations.manage only (00005:155-178); FORCE RLS (00005:86) | closed |
| T-02-03-03 | Tampering | deriveStatus threshold math | medium | mitigate | single shared helper + calendar-day math via date-fns (src/lib/status.ts:5,21,41); deterministic fixed-now tests (status.test.ts:8,52-61) | closed |
| T-02-03-04 | Info Disclosure | D-42 privacy boundary | high | mitigate | schema lacks diagnosis/finding/history columns (00005:61-71); action schemas whitelist administrative fields only (medical/actions.ts:13-28) | closed |
| T-02-04-01 | Elevation | linkStaffToUser (role grant) | high | mitigate | staff.manage guard (people/actions.ts:67-73); role via z.enum(roleValues), no super_admin (:22-27,222); WR-04 DB gate = club_president only (:232-241); member upsert + compensation (staff.ts:341-358) | closed |
| T-02-04-02 | Info Disclosure | staff/guardian reads by coach | high | mitigate | staff_select policy (00006:97-98); guardians via athletes.view OR staff.view (00006:196); coach self-scope in staff.ts:72-79; WR-03 coach staff.view grant (00013:15) | closed |
| T-02-04-03 | Tampering | one-primary guardian invariant | medium | mitigate | normalizeGuardianPrimary pure fn (guardian.ts:47) + tests (guardian.test.ts:21-51); partial unique index (00006:75) | closed |
| T-02-04-04 | Tampering | staff_teams season scoping | low | mitigate | season_id FK + UNIQUE(staff_id, team_id, season_id) (00006:36,38); active-season reads (staff.ts:114-115) | closed |
| T-02-05-01 | Info Disclosure | storage.objects IDOR via path guessing | critical | mitigate | bucket private (00007:76-90); SELECT/INSERT/UPDATE/DELETE policies scope foldername(name)[1] = org claim + authorize() (00007:167-202); downloads exclusively createSignedUrl <= 604800s (storage.ts:8,43-56); never getPublicUrl | closed |
| T-02-05-02 | Info Disclosure | medical certificates on shared screens | high | mitigate | documents.view RLS (00007:101-106); /documents overview metadata only for permissioned roles (documents/page.tsx:25-30); medical page renders status only (medical/page.tsx:36-52) | closed |
| T-02-05-03 | Tampering | oversized/typed uploads | medium | mitigate | bucket file_size_limit 10485760 + MIME allowlist (00007:86-87); action-level byte+MIME check (documents/actions.ts:82-87) | closed |
| T-02-05-04 | Elevation | contract/document action args | high | mitigate | zod whitelists (documents/actions.ts:36-45, contracts/actions.ts:18-30); org-scoped owner validation (:54-68, :40-71); requireOrganization() + permission per write | closed |
| T-02-06-01 | Tampering | xlsx parsing prototype pollution | critical | mitigate | npm xlsx FORBIDDEN; exceljs streaming + csv-parse strict relax_column_count:false (parsers.ts:1-2,8; package.json:22,24); cells never evaluated (:80-84) | closed |
| T-02-06-02 | Tampering | formula injection via imported cells | high | mitigate | cells as data never evaluated (parsers.ts:80-84); csvEscaped prefixes =,+,-,@ on export paths (rows.ts:220; equipment-export.ts:1,26,40); tested (equipment-export.test.ts:62) | closed |
| T-02-06-03 | Elevation | mass athlete creation via batch actions | high | mitigate | per-call hasPermission('athletes.create') + org scope (import/actions.ts:115-116,156-157); max_players entitlement gate (:163,191,307); zod row schema (:317); org-scoped job RLS (00008:38,43-62) | closed |
| T-02-06-04 | Tampering | duplicate detection on null DOB | medium | mitigate | findDuplicate requires complete identity key incl. DOB (rows.ts:181-192); null-DOB rows cannot merge (rows.test.ts:62-66) | closed |
| T-02-07-01 | Tampering | state transition validity | medium | mitigate | transitionAthleteItem whitelists legal edges; invalid pairs rejected in lib (equipment.ts:300-305,327) | closed |
| T-02-07-02 | Tampering | CSV formula injection on export | high | mitigate | equipment-export escapes =,+,-,@ fields (equipment-export.ts:1,26,40); CSV is data never evaluated; tested (equipment-export.test.ts:62) | closed |
| T-02-07-03 | Elevation | request approval / type config | high | mitigate | requireEquipmentPermission (equipment/actions.ts:30-32); decideRequest + type mutations gated to equipment.manage (:63,72,81,101,109,117,146); createRequest = equipment.report (:125) | closed |
| T-02-07-04 | Info Disclosure | equipment overview exposure | medium | mitigate | FORCE + org-scoped RLS (00009:137-141,148-274); view/report/manage seeds (00010:20-22,33-34,42-43,50-51); nav entry gated by equipment.view (rbac.ts:17,30,41,50) | closed |
| T-02-08-01 | Tampering | SUPABASE_ACCESS_TOKEN exposure | critical | mitigate | token only via env var, never committed/echoed; non-TTY run refuses interactive login (02-08-PLAN.md:90-92); .gitignore:34 (.env*), :44 (supabase/.temp/) | closed |
| T-02-08-02 | Tampering | drift between pushed SQL and applied migrations | high | mitigate | [BLOCKING] task stops if push diff beyond expected (02-08-PLAN.md:88,96); post-push migration list verified (02-08-SUMMARY.md:56-60,106-110); fixes land as NEW migrations 00010..00013, applied ones never edited | closed |
| T-02-08-03 | Info Disclosure | generated types leak into committed source | low | accept | database.ts is public client-safe type surface; no credentials or RLS internals (02-08-PLAN.md:140) | closed (accepted) |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on (high) count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-02-01-02 | package.json/lockfile — installs pinned from RESEARCH.md; a drifting transitive dep is out of Phase 2 scope | plan (02-01-PLAN.md) | 2026-08-28 |
| AR-02 | T-02-08-03 | src/types/database.ts generated types — public client-safe type surface; no credentials or RLS internals exposed beyond existing conventions | plan (02-08-PLAN.md) | 2026-08-28 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-28 | 30 | 30 | 0 | opencode (gsd-security-auditor) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-28