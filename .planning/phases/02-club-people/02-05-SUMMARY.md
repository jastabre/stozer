---
phase: 02-club-people
plan: 05
subsystem: documents-contracts
tags: [supabase, storage, rls, signed-urls, documents, contracts, nextjs, i18n]

# Dependency graph
requires:
  - phase: 02-club-people
    provides: seasons, teams, athletes, staff, registrations, medical examinations, shared expiry status, org warning threshold, and permission-gated server-action patterns
provides:
  - Typed polymorphic documents metadata for athlete and staff owners
  - Private club-documents Storage bucket with org-folder RLS and signed-URL downloads
  - Athlete and staff document upload/list/download/delete UI with expiry pills
  - Registration and medical certificate document linkage
  - Player contract CRUD with typed status, dates, linked contract document, and expiry warning
  - Organization-wide expiry overview with document-type and tone filters
affects: [02-06, 02-07, 02-08, dashboard, club-documents]

# Actuals (#2632)
actuals:
  tokens: 24265
  tasks: 3
  commits: 5

# Tech tracking
tech-stack:
  added: []
  patterns:
    - One polymorphic documents table uses owner_type/owner_id for athlete and staff records; owner membership is validated in server actions.
    - All private document object paths begin with organization_id and use a fixed 604800-second signed URL lifetime.
    - Document and contract expiry tones reuse documentTone/deriveStatus and organization_settings.warning_threshold_days.
    - Server actions re-authorize independently, derive organization identity from requireOrganization, validate cross-record links, and clean up uploaded files when metadata insertion fails.

key-files:
  created:
    - supabase/migrations/00007_documents_contracts.sql
    - src/lib/storage.ts
    - src/app/[locale]/(dashboard)/documents/actions.ts
    - src/components/documents/DocumentSection.tsx
    - src/components/documents/DocumentDownloadButton.tsx
    - src/app/[locale]/(dashboard)/players/[id]/documents/page.tsx
    - src/app/[locale]/(dashboard)/players/[id]/contracts/actions.ts
    - src/app/[locale]/(dashboard)/players/[id]/contracts/page.tsx
    - src/app/[locale]/(dashboard)/documents/page.tsx
  modified:
    - src/types/database.ts
    - src/lib/club-data.ts
    - src/app/[locale]/(dashboard)/people/[id]/page.tsx
    - src/app/[locale]/(dashboard)/players/[id]/registrations/actions.ts
    - src/app/[locale]/(dashboard)/players/[id]/registrations/page.tsx
    - src/app/[locale]/(dashboard)/players/[id]/medical/actions.ts
    - src/app/[locale]/(dashboard)/players/[id]/medical/page.tsx
    - messages/sr.json
    - messages/en.json

key-decisions:
  - "Use the reserved migration slot 00007_documents_contracts.sql despite the stale 00006 filename in PLAN.md; 00006_staff_guardians.sql already exists and 00008_import_jobs.sql is reserved by 02-06."
  - "Use one private club-documents bucket rooted at {organization_id}/athletes|staff/{owner_id}/ and issue only seven-day signed URLs; no public object URLs are used."
  - "Keep document ownership polymorphic without database owner FKs, but validate owner organization and document type before every upload or linkage write in the server layer."
  - "Treat missing document expiry as a distinct no-expiry overview tone while leaving athlete profile rows without a false valid/expired pill."

patterns-established:
  - "Storage path convention: {organization_id}/{athletes|staff}/{owner_id}/{uuid}-{sanitizedFilename}; storage RLS compares foldername(name)[1] to the JWT organization claim."
  - "Contract stored status and derived expiry tone are displayed together, so manual lifecycle state does not replace date-driven warning state."

requirements-completed: [REG-04, REG-06, REG-07, REG-09]

coverage:
  - id: D1
    description: "Typed documents and contracts schema with FORCE RLS, private club-documents bucket, and organization-folder storage policies"
    requirement: REG-04
    verification:
      - kind: other
        ref: "supabase/migrations/00007_documents_contracts.sql — local SQL review for private bucket, FORCE RLS, foldername()[1], and authorize() policies"
        status: pass
    human_judgment: true
    rationale: "Live migration application and cross-tenant RLS behavior require the Phase 2 schema-push gate in 02-08."
  - id: D2
    description: "Private upload, metadata insertion, expiry-aware document lists, and signed-URL-only download/delete flow for athlete and staff owners"
    requirement: REG-06
    verification:
      - kind: other
        ref: "npm run typecheck"
        status: pass
      - kind: other
        ref: "source scan: no getPublicUrl references; signed URL lifetime is SIGNED_URL_EXPIRES_IN = 604800"
        status: pass
    human_judgment: true
    rationale: "Storage byte enforcement, RLS, and browser interaction need live Supabase and manual verification after schema push."
  - id: D3
    description: "Registration and medical records can link only to same-athlete registration/medical document rows, and their pages expose the validated linkage selectors"
    requirement: REG-04
    verification:
      - kind: other
        ref: "npm run typecheck"
        status: pass
    human_judgment: true
    rationale: "The server-side owner/type checks are statically verified; live permission behavior remains a manual gate."
  - id: D4
    description: "Player contracts CRUD tracks type, draft/active/terminated/expired status, dates, optional contract document, and shared expiry warning tone"
    requirement: REG-09
    verification:
      - kind: other
        ref: "npm test — 37 tests passed"
        status: pass
      - kind: other
        ref: "npm run typecheck"
        status: pass
    human_judgment: true
    rationale: "Server action CRUD and live document linkage require browser/RLS verification against the pushed schema."
  - id: D5
    description: "Organization-wide documents page lists expiring, expired, and no-expiry documents with owner, type, tone filters, signed downloads, and permission-sensitive deletion"
    requirement: REG-07
    verification:
      - kind: other
        ref: "npm run build — /[locale]/documents and player contract/document routes compiled"
        status: pass
    human_judgment: true
    rationale: "Filter interactions and visual expiry review are not covered by the current Vitest suite."

# Metrics
duration: 27min
completed: 2026-08-27
status: complete
---

# Phase 2 Plan 5: Documents & Contracts Summary

**Private organization-scoped athlete/staff documents with seven-day signed downloads, expiry-aware central review, linked registration/medical certificates, and basic player contracts.**

## Performance

- **Duration:** 27 min
- **Started:** 2026-08-27T21:46:00Z
- **Completed:** 2026-08-27T22:12:16Z
- **Tasks:** 3
- **Files modified:** 21 implementation files

## Accomplishments

- Added `00007_documents_contracts.sql` with `document_type` and `contract_status` enums, one polymorphic `documents` table for athletes and staff, basic `contracts`, indexes, updated-at triggers, and FORCE RLS.
- Created the private `club-documents` bucket with PDF/JPEG/PNG allowlist, 10 MB limit, and storage policies scoped to the first organization folder plus `documents.view`/`documents.manage`.
- Added path sanitization, organization-bound storage operations, and a hard-capped 604800-second signed URL helper. Upload actions enforce file type/size, owner organization, custom type, date order, and cleanup on metadata failure.
- Reused the document section on athlete and staff profiles. Downloads are opened by a client button after the server action returns a signed URL; no public URL API is referenced.
- Connected registration documents and medical certificates to their existing `document_id` columns with same-owner/type validation.
- Added contract CRUD with status/date validation and contract-document linkage, plus an organization-wide `/documents` expiry surface for expiring, expired, and no-expiry rows with type/tone filters.
- Added Serbian and English copy for every document, linkage, contract, and expiry-overview state.

## Task Commits

Each task was committed atomically:

1. **Task 1: Migration 00006 — documents, contracts, private bucket, storage.objects RLS** — `cb29e74` (feat; implemented in reserved migration 00007)
2. **Task 2: Storage helper + athlete documents page and staff section** — `bee02c1` (feat)
3. **Task 3: Player contracts UI + org-wide documents overview** — `e5e754c` (feat)

**Task follow-up:** `dc6c3ff` (fix: remove the public URL API name from source comments so the signed-URL static verification is unambiguous)

**Plan metadata:** pending docs/tracking commit.

## Files Created/Modified

- `supabase/migrations/00007_documents_contracts.sql` — typed tables, private bucket, document/contract RLS, and storage object policies.
- `src/types/database.ts` — `DocumentType`, `ContractStatus`, and database table/enum shapes.
- `src/lib/storage.ts` — sanitized org-rooted paths, signed URLs capped at seven days, and scoped deletion.
- `src/lib/club-data.ts` — document overview, owner name resolution, contract reads, and expiry tone helpers.
- `src/app/[locale]/(dashboard)/documents/actions.ts` — authenticated upload/download/delete actions with validation and cleanup.
- `src/components/documents/DocumentSection.tsx` — reusable athlete/staff document list and upload form.
- `src/components/documents/DocumentDownloadButton.tsx` — client-side signed URL opener with pending/error state.
- `src/app/[locale]/(dashboard)/players/[id]/documents/page.tsx` — athlete documents page.
- `src/app/[locale]/(dashboard)/people/[id]/page.tsx` — staff document section.
- `src/app/[locale]/(dashboard)/players/[id]/contracts/{actions.ts,page.tsx}` — contract CRUD and linkage UI.
- `src/app/[locale]/(dashboard)/documents/page.tsx` — organization-wide expiry overview and filters.
- Registration/medical pages and actions — validated certificate/document linkage selectors.
- `messages/sr.json`, `messages/en.json` — localized documents, contracts, linkage, and overview strings.

## Decisions Made

- The migration is numbered `00007_documents_contracts.sql` because the existing `00006_staff_guardians.sql` occupies the plan's stale frontmatter slot and `00008_import_jobs.sql` is already owned by 02-06. This preserves the phase sequence without overwriting 00008.
- A single private bucket is used for both athlete and staff files. Organization-rooted paths make the `storage.foldername(name)[1]` RLS check the same boundary as table `organization_id`.
- Missing expiry is represented as `none` on the central overview, not as a green “valid” state. Athlete profile rows omit a pill when no expiry is supplied, matching the product rule that null must not mean valid forever.
- Registration and medical attachment selectors were completed here, as promised by the prior plan's forward-reference guard; each action verifies organization, owner type, owner id, and document type before writing a linkage.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used reserved migration slot 00007 instead of stale 00006**

- **Found during:** Task 1 (migration creation)
- **Issue:** `00006_staff_guardians.sql` already existed from 02-04, while the plan still named `00006_documents_contracts.sql`.
- **Fix:** Created `00007_documents_contracts.sql`, preserving the user-provided reservation and leaving `00008_import_jobs.sql` untouched.
- **Files modified:** `supabase/migrations/00007_documents_contracts.sql`
- **Verification:** Migration inventory and prior summaries checked; typecheck, tests, and build passed.
- **Committed in:** `cb29e74`

**2. [Rule 2 - Missing Critical] Added shared document actions/components and registration/medical linkage validation**

- **Found during:** Tasks 2–3 (document workflow review)
- **Issue:** A secure upload/list/download flow needed colocated server actions and a reusable UI, and the existing `registrations.document_id`/`medical_examinations.document_id` columns were not usable from their forms despite the prior plan promising the linkage dropdown in this module.
- **Fix:** Added shared permission-gated actions/components, owner organization checks, file validation, storage cleanup, and same-athlete/document-type linkage selectors and validation.
- **Files modified:** document action/component/page files plus registration and medical action/page files.
- **Verification:** `npm test` (37 passed), `npm run typecheck`, `npm run build`, and static signed-URL scan passed.
- **Committed in:** `bee02c1`, `e5e754c`

**3. [Rule 1 - Verification bug] Removed a misleading public-URL API name from a source comment**

- **Found during:** final static check
- **Issue:** The source contained the forbidden API name only in a comment explaining what not to use, which made a literal no-public-URL scan report a false positive.
- **Fix:** Reworded the comment while retaining the private-storage intent.
- **Files modified:** `src/lib/storage.ts`
- **Verification:** source scan returned no public URL API references; typecheck passed.
- **Committed in:** `dc6c3ff`

---

**Total deviations:** 3 auto-fixed (1 × Rule 3 blocking, 1 × Rule 2 missing-critical, 1 × Rule 1 verification bug).
**Impact on plan:** The numbering change preserves migration integrity; the action/component and linkage additions complete the secure document workflow without changing the architecture or scope.

## Issues Encountered

- No live Supabase project or local Docker emulator was available, so migration execution, Storage RLS behavior, cross-tenant isolation, and browser upload/download interaction remain part of 02-08's schema-push/manual gate. All requested automated checks passed.
- Vitest reports existing Vite configuration deprecation warnings; the suite remains green and no unrelated configuration was changed.

## Known Stubs

None in files created or modified by this plan. Empty document/contract states are intentional data-driven UI states.

## User Setup Required

None — no new external service configuration is required.

## Next Phase Readiness

- The migration sequence is now `00001` through `00008` with `00007` owned by documents/contracts; 02-07 should use its reserved `00009_equipment.sql` slot.
- Registration and medical certificate linkage is now available, and staff profiles can use the same documents model as athletes.
- 02-08 should push migrations `00002..00009`, verify Storage/table RLS with two organizations and role permutations, and perform browser UAT for upload size/type rejection, signed downloads, expiry filters, contract linkage, and deletion.

---
*Phase: 02-club-people*
*Completed: 2026-08-27*

## Self-Check: PASSED

All 21 implementation files listed in the execution diff are present. Task commits `cb29e74`, `bee02c1`, `e5e754c`, and follow-up `dc6c3ff` are present in git history. Final `npm test` (37 passed), `npm run typecheck`, and `npm run build` all passed.
