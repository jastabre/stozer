---
schema_version: 1
open_count: 0
waived_count: 0
fixed_count: 2
total_count: 2
last_updated: 2026-09-30T19:10:21.863Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 02 | unrun-verify | src/app/[locale]/(dashboard)/club/page.tsx |  | Manual DB/UI check (threshold persistence -> profile pills reflect it) deferred: no live Supabase; schema push is 02-08's gate | fixed |  | 2026-08-27T16:19:33.043Z | 2026-09-30T19:10:21.863Z |
| 2 | 02 | deviation | src/app/[locale]/(dashboard)/players/[id]/registrations/page.tsx |  | registrations.document_id linkage dropdown deferred to 02-05 (documents table = 00006) per W1 cross-plan forward-reference guard | fixed |  | 2026-08-27T16:19:33.634Z | 2026-08-27T22:13:10.638Z |

````json
[
  {
    "id": 1,
    "kind": "unrun-verify",
    "phase": "02",
    "file": "src/app/[locale]/(dashboard)/club/page.tsx",
    "line": null,
    "description": "Manual DB/UI check (threshold persistence -> profile pills reflect it) deferred: no live Supabase; schema push is 02-08's gate",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-27T16:19:33.043Z",
    "resolved_at": "2026-09-30T19:10:21.863Z"
  },
  {
    "id": 2,
    "kind": "deviation",
    "phase": "02",
    "file": "src/app/[locale]/(dashboard)/players/[id]/registrations/page.tsx",
    "line": null,
    "description": "registrations.document_id linkage dropdown deferred to 02-05 (documents table = 00006) per W1 cross-plan forward-reference guard",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-27T16:19:33.634Z",
    "resolved_at": "2026-08-27T22:13:10.638Z"
  }
]
````
