# Stožer — Agent Instructions

## Project

Multi-tenant SaaS for sports clubs (football/basketball, Serbia first, global-ready). Next.js + TypeScript + Supabase/Postgres.

## Sources of truth (plain-text pointers — NEVER @-import these)

- `STOZER-BRIEF.md` — product/domain spec. Consult before changing business logic, domain models, UX direction, or monetization. Do not load routinely.
- `.planning/HANDOFF.json` + `.planning/phases/02-club-people/.continue-here.md` — current work; read FIRST when resuming (fresher than STATE.md prose).
- `.planning/STATE.md` / `.planning/ROADMAP.md` — phase & plan status.
- `.planning/REQUIREMENTS.md` — requirement IDs (checkboxes may lag; see `.planning/phases/02-club-people/02-VERIFICATION.md`).

## GSD workflow

- Execution runs through GSD: `/gsd-*` commands; read-only state via the gsd MCP tools (`mcp__gsd__gsd_read_state`).
- Never hand-edit `.planning/` — reconcile through GSD tooling.

## PROMPT MASTER — MANDATORY

- For every Stožer request, before analysis/planning/implementation, activate the installed `prompt-master` skill to interpret and sharpen the request. Do not wait for an explicit `/prompt-master`.
- Applies to: development/implementation, debugging, UI/UX, refactoring, Supabase/DB, RLS, migrations, tests, GSD phase planning & execution, existing-code review, architecture, small changes & polish, and project documentation.
- Use it to pin down: goal, relevant context, constraints, acceptance criteria, risks and things to verify. Then continue directly with the real task, using other relevant installed skills. Never return only the optimized prompt and never ask the user to re-send it — `prompt-master` is an internal step; the deliverable is the finished analysis/implementation.
- `prompt-master` improves the instruction but MUST NOT change product decisions or Stožer source-of-truth. On conflict, precedence is: (1) latest explicit user instruction, (2) `AGENTS.md`, (3) `STOZER-BRIEF.md`, (4) current GSD plan / `.planning`, (5) actual code & database state where checking what is implemented.
- All existing Stožer rules still apply (verify real code/UI/DB not just docs; use GSD workflow; UAT not done until user confirms; non-destructive migrations; never reset Supabase; find root cause; finite typecheck/tests/build; use relevant installed skills; no browser automation without explicit request).

## Standing engineering rules

- TypeScript strict; RLS (ENABLE + FORCE) on every table; `organization_id` scoping everywhere.
- Migrations are append-only — add a new migration, never edit applied ones.
- Financial operations atomic (transactions); audit trail on sensitive changes.
- Never rely on UI hiding for security — server-side + database checks.
- i18n via `messages/{en,sr}.json` — sr-Latn primary; never hardcode currency/date formats.

## Environment (Windows)

- Command Code CLI binary is `cmdc` (bare `cmd` is the Windows shell).
- Quote paths with parentheses in git/PowerShell (e.g. `git add "src/app/(auth)/"`).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
