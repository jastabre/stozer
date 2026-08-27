---
phase: 2
slug: club-people
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-27
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest + @vitejs/plugin-react + jsdom + @testing-library/react + @testing-library/dom + @testing-library/jest-dom + vite-tsconfig-paths **[CITED: node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md]** |
| **Config file** | `vitest.config.ts` + `vitest.setup.ts` — created in 02-01 Task 3 (Wave 0) |
| **Quick run command** | `npx vitest run src/lib/__tests__/<target>.test.ts` (targeted per task) |
| **Full suite command** | `npm test` (package script = `vitest run`); `npx vitest run --coverage` for wave merges |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run the target test file: `npx vitest run src/lib/__tests__/<file>.test.ts`
- **After every plan wave:** Run the full suite: `npm test` (= `vitest run`)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | STRC-01 | T-02-01 / — | N/A | unit | `npm test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Populated by the executor as tasks are created; Wave 0 installs test stubs and shared fixtures.*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` + `vitest.setup.ts` (02-01 Task 3)
- [ ] Wave-0 stubs: `src/lib/__tests__/{athlete-id,status,rows,guardian,rollover}.test.ts` (02-01 Task 3) — later plans replace stub bodies with real RED tests
- [ ] vitest + @testing-library/* + jsdom + vite-tsconfig-paths installed (02-01, after the blocking-human package-legitimacy gate)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CSV/XLSX column-mapping wizard UX | REG-08 | Interactive file mapping cannot be faithfully automated | Import a CSV, map columns, validate preview, confirm import |
| Green/yellow/red registration status rendering | REG-03 | Visual expiry-state indicators | Open a player's registration with expiry warnings and verify indicator colors |

*All other phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
