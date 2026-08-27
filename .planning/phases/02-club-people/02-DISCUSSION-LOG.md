# Phase 2: Club & People - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-27
**Phase:** 2-Club & People
**Areas discussed:** Season & team lifecycle, Player identity & athlete ID, Registration system & status, Bulk player import UX, Staff & user accounts, Guardians & documents, Equipment (whole-phase addition), Sports Medical Examinations (whole-phase addition)

---

## Season & Team Lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Teams persist; membership is seasonal | A team is a persistent record; active season links athletes to teams via seasonal membership | ✓ |
| Teams recreated per season | Each season creates fresh team records | |

**User's choice:** Teams persist; membership is seasonal
**Notes:** Matches brief §22 permanent identity + §57.

| Option | Description | Selected |
|--------|-------------|----------|
| Single active season | Exactly one active season at a time | ✓ |
| Multiple active seasons | Multiple can be active simultaneously | |

**User's choice:** Single active season

| Option | Description | Selected |
|--------|-------------|----------|
| Guided rollover with review | Start New Season copies teams/staff, user moves athletes (U15→U17) | ✓ |
| Auto-copy, adjust after | Copies everything automatically | |
| Manual setup | Empty season, users add manually | |

**User's choice:** Guided rollover with review

| Option | Description | Selected |
|--------|-------------|----------|
| Archived but viewable | Past seasons hidden, accessible via filter | ✓ (custom) |
| Hide past seasons by default | Only active season shown | |

**User's choice (custom):** Past seasons archived and hidden from all default views; active season is default; accessible via simple season selector/filter. History NOT a prominent standalone V1 feature. Player profiles show previous memberships only in a secondary/collapsed area.

---

## Player Identity & Athlete ID

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-assign sequential number | Stable sequential club ID, used as poziv na broj | ✓ |
| Manual entry only | User enters each club ID | |
| Auto with manual override | Auto-assign by default, override allowed | |

**User's choice:** Auto-assign sequential number

| Option | Description | Selected |
|--------|-------------|----------|
| Generic athlete_identifiers | Brief §13 generic type+value system | |
| Single club_id column | One column on athlete | |

**User's choice (custom):** Keep federation/external IDs out of the core athlete identity model in V1. Only a simple optional free-text "Federation / Registration ID" field on the profile (reference only). Stožer does not validate/interpret/use it, and it is unrelated to the club athlete ID. Federation integration data model designed when an integration is actually built.

| Option | Description | Selected |
|--------|-------------|----------|
| Single equipment size + free-text position | One size + position per sport | |
| Split equipment sizes | jersey/shorts/tracksuit now | |

**User's choice (custom, detailed):** Equipment supports two related use cases:
1. **Player equipment** — configurable equipment types (Match Kit top+bottom, Tracksuit top+bottom, Training Kit shirt+shorts, custom); clubs disable unused types; athletes store optional sizes for enabled types with youth/adult presets + custom. Later: record whether equipment issued (new/promoted player = missing kit). Exports by team always include surname, first name, jersey number, selected sizes, optionally assignment status; user chooses types.
2. **Shared team/training equipment** — later lightweight quantity tracking (balls, cones, bibs), assigned to team or staff, issued/returned/lost/damaged; coaches report missing/damaged + simple equipment requests. Permission-based (View / Report needs / Manage), role presets + custom grants.
**V1 boundary:** Do NOT build inventory/procurement system — no QR codes, serial tracking, warehouses, suppliers, purchasing. Structure athlete equipment sizing + jersey number correctly now and preserve the remaining requirements for the appropriate phase.

---

## Registration System & Status

| Option | Description | Selected |
|--------|-------------|----------|
| One registration per athlete per season | status + expiry, per-season | |
| Single status on profile | one mutable status | |

**User's choice (custom):** Simple time-based record — not strictly one-record-per-season, not a single mutable profile status. Records have status, valid_from, valid_until, optional season association, optional document, warning threshold. Athlete profile shows only current status, derived from active/latest record + expiry. Past records kept in background. Do NOT assume registrations are always season-bound (rules differ by sport/country/federation).

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-derived from expiry + configurable threshold | GREEN/YELLOW/RED from dates | ✓ |
| Manual status field | user sets status | |

**User's choice:** Auto-derived from expiry + configurable threshold

| Option | Description | Selected |
|--------|-------------|----------|
| Org-level default threshold | single adjustable (e.g., 30 days) for all | ✓ |
| Per-type thresholds | separate per registration/doc/license | |

**User's choice:** Org-level default threshold

| Option | Description | Selected |
|--------|-------------|----------|
| Unified athlete document store | registration doc = document type in one store | ✓ |
| Separate registration doc store | parallel storage path | |

**User's choice:** Unified athlete document store

---

## Bulk Player Import UX

| Option | Description | Selected |
|--------|-------------|----------|
| Full wizard, server-side processing | upload→mapping→preview→validation→import | ✓ |
| Simple, no mapping | fixed column order | |
| Full wizard, client-side parsing | parse in browser | |

**User's choice:** Full wizard, server-side processing

| Option | Description | Selected |
|--------|-------------|----------|
| Validate against existing teams | unknown team names = errors | ✓ |
| Auto-create teams from import | create teams on the fly | |

**User's choice:** Validate against existing teams

| Option | Description | Selected |
|--------|-------------|----------|
| Detect duplicates in preview | by club ID or first+last+DOB, skip/update/create | ✓ |
| No duplicate detection | create without checking | |

**User's choice:** Detect duplicates in preview

---

## Staff & User Accounts

| Option | Description | Selected |
|--------|-------------|----------|
| Staff profile separate from login | staff can exist without accounts | ✓ |
| Staff = user account | every staff must have login | |

**User's choice:** Staff profile separate from login

| Option | Description | Selected |
|--------|-------------|----------|
| Link profile to account, assign app role + teams | coach sees own teams | ✓ |
| Separate staff title enum | displays + access via title | |

**User's choice:** Link profile to account, assign app role + teams

| Option | Description | Selected |
|--------|-------------|----------|
| License on staff profile + expiry alert | | |
| Separate license entity | | |

**User's choice (custom):** Stožer licensing/subscription is organization-based, NOT per-user or per-seat. A club purchases one subscription and may create/link staff accounts as needed without extra user licenses. User accounts exist only for auth + permissions; not separately licensed/billed. Staff profiles remain separate from login accounts.

**Follow-up clarification (professional coaching license):** Confirmed — in addition to org-based Stožer licensing, track each coach's professional/federation coaching license on the staff profile (type, number, expiry, optional document), with green/yellow/red alerts using the org warning threshold. This is what STRC-06/STRC-09 refer to.

---

## Guardians & Documents

| Option | Description | Selected |
|--------|-------------|----------|
| Multiple guardians, one primary | name, relationship, phone, email, preferred contact | ✓ |
| Single guardian | one name + one phone | |

**User's choice:** Multiple guardians, one primary

| Option | Description | Selected |
|--------|-------------|----------|
| Supabase Storage + metadata table | per-org buckets + documents table | ✓ |
| DB-only storage | base64/metadata only | |

**User's choice:** Supabase Storage + metadata table

| Option | Description | Selected |
|--------|-------------|----------|
| One documents table, typed + linked to owner | athlete + staff from one model | ✓ |
| Separate tables per entity | athlete_documents, staff_documents | |

**User's choice:** One documents table, typed + linked to owner

---

## Equipment (whole-phase addition via IMPORTANT SCOPE NOTE)

**User's choice (custom scope note):** Equipment is a dedicated operational area, not only athlete-profile fields. Navigation via a dedicated Equipment menu visible only to users with relevant equipment permissions (permission-based, not role-bound). Three areas: Player Equipment, Team/Training Equipment, Equipment Requests. Details matching D-23..D-32 were captured (configurable types, size-needed vs issued states, player equipment overview with counts/filters, jersey number on membership, equipment export, lightweight team quantity tracking, equipment requests with Requested/Approved/Purchased/Rejected status, five-question V1 boundary, no ERP/inventory/procurement).
**Notes:** Preserve the broader equipment requirements for the appropriate phase if the complete workflow extends beyond Phase 2; implement only the data structures needed by the current phase. Do not force equipment into Guardians/Documents.

---

## Sports Medical Examinations (whole-phase addition via IMPORTANT SCOPE NOTE)

**User's choice (custom scope note):** Core V1 athlete requirement, completely separate from federation registration/licensing. Structured per-athlete record: examination date, valid_until, derived status, optional note, optional certificate. Statuses: Not recorded / Valid / Expiring soon / Expired. No hard-coded global validity — store actual valid_until. Expiry uses org-level warning threshold. Care on athlete profile + team/selection overview/filters; participates in central alerts; no separate top-level Medical menu. Registration and medical are separate (never one status). NOT a medical-record system — only minimum administrative sports-clearance info (completed, date, valid-until, status, optional cert); access via role/permission; documents in private permission-controlled storage, no public URLs.

---

## the agent's Discretion

- Team creation fields and defaults
- Exact seed/RBAC preset permissions per role for new Phase 2 features
- Warning-threshold default value and configuration location
- CSV template design and required vs optional import fields
- Equipment type seed data and size presets
- Athlete profile field layout and required vs optional
- Team/roster UI structure (list vs cards)

## Deferred Ideas

- Full athlete_identifiers generic system / federation integrations (COMET) — data model designed when integration is built
- Parent portal / guardian accounts
- Detailed player development / athlete notes system
- First-team finances (salaries, bonuses)
- Advanced equipment full inventory/procurement ERP
- Athlete notes module
- Staff import (noted as "later" in brief §58)
