# Phase 1: Foundation - Context

**Gathered:** 2026-08-26
**Status:** Ready for planning

<domain>
## Phase Boundary

A running Next.js app with Supabase where users can sign up, create an organization, and see a basic app shell — the infrastructure every later feature depends on. Includes multi-tenant RLS, auth, RBAC, i18n, subscription entitlements, and role-based navigation.

</domain>

<decisions>
## Implementation Decisions

### App Shell & Layout
- **D-01:** Left sidebar navigation, collapsible on mobile — **Reversibility:** costly — [changing layout pattern affects every page component and routing structure]
- **D-02:** Clean & neutral design direction — club colors used only as accent (buttons, active states, headers), core UI stays neutral — **Reversibility:** reversible — [CSS variable swap]
- **D-03:** Logo displayed in sidebar header, club accent colors on interactive elements — **Reversibility:** reversible — [component prop changes]

### Organization Onboarding
- **D-04:** Single-step organization creation — user enters name, sport, country, language, currency, timezone on one form. Logo and colors editable later in settings — **Reversibility:** reversible — [form field additions]
- **D-05:** First user automatically assigned Club President role with full access — **Reversibility:** one-way — [role assignment is foundational to RBAC; changing first-user role requires migration and permission restructure]
- **D-06:** Single organization per user in V1 — no org switching UI. Multi-org support deferred to post-V1 — **Reversibility:** costly — [adding org switching requires sidebar dropdown, session management, and RLS context switching]

### Subscription & Trial UX
- **D-07:** FREE plan limits enforced as visible + locked — premium features shown with lock icon and inline upgrade CTA, permission-restricted features completely hidden — **Reversibility:** costly — [enforcement pattern is applied across every feature gate]
- **D-08:** Upgrade CTA appears inline on the feature itself (lock icon + tooltip) — not banners or dedicated pages — **Reversibility:** reversible — [CTA component swap]
- **D-09:** Default trial duration: 14 days of CLUB features, no credit card required. Duration configurable via Super Admin — **Reversibility:** reversible — [config value change]
- **D-10:** Trial expiry: lock premium features, keep all data accessible. User retains FREE features — **Reversibility:** reversible — [expiry behavior config]

### Empty State & First Use
- **D-11:** Empty dashboard shows contextual empty states per section — each section has its own CTA ("No teams yet — create your first team") — **Reversibility:** reversible — [component content change]
- **D-12:** User guided by context, no forced order — user picks what to do first from empty state CTAs — **Reversibility:** reversible — [UX flow change]
- **D-13:** Full sidebar navigation shown for new users, unavailable items grayed out — user sees full app structure from day one — **Reversibility:** reversible — [nav visibility logic]

### the agent's Discretion
- App shell responsive breakpoints (desktop/tablet/mobile thresholds)
- Sidebar collapse trigger point
- Exact FREE tier numeric limits (brief suggests: 1 club, 1 sport, 1 selection, 20 players, 2 staff — agent may adjust for implementation)
- i18n library choice (next-intl recommended by research)
- PWA configuration details (Serwist setup)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product Requirements
- `STOZER-BRIEF.md` — Product source of truth. §6 (FREE plan), §7 (FREE plan details), §8 (Trial), §17-19 (Navigation per role), §20 (Dashboard), §41 (Global architecture), §74 (Implementation order)
- `.planning/REQUIREMENTS.md` — 60 v1 requirements. Phase 1 maps to: CORE-01 through CORE-09

### Technical Research
- `.planning/research/SUMMARY.md` — Research synthesis with key findings, anti-patterns, and foundation-first approach
- `.planning/research/ARCHITECTURE.md` — Multi-tenant patterns, RBAC authorize() function, RLS policies, JWT custom claims, financial data patterns
- `.planning/research/STACK.md` — Technology choices and rationale
- `.planning/research/PITFALLS.md` — Known risks and mitigations

### Project Context
- `.planning/PROJECT.md` — Project context, requirements, constraints, key decisions
- `.planning/ROADMAP.md` — 7-phase roadmap with success criteria
- `.planning/STATE.md` — Current project state

### Engineering Rules
- `AGENTS.md` — Engineering workflow, security, financial correctness, testing, mobile, UI principles

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, starting fresh

### Established Patterns
- None — patterns will be established in this phase

### Integration Points
- Supabase project not yet created — Phase 1 task
- No existing code — all infrastructure built from scratch

</code_context>

<specifics>
## Specific Ideas

- Navigation structure per role defined in STOZER-BRIEF.md §17-19: President sees all 8 sections, Youth Director sees 5, Coach sees 4 mobile-first items
- Dashboard is not just numbers — it tells the user what they need to know today and what needs attention (brief §20)
- UI strings built through i18n system from the start (brief §11)
- Organization must store: country, locale, timezone, default currency, language (brief §11)
- Initial languages: sr-Latn and en, architecture must support sr-Cyrl, de, es, it, fr (brief §11)

</specifics>

<deferred>
## Deferred Ideas

- Multi-organization switching (D-06 decided single org in V1)
- Logo and color customization during onboarding (deferred to settings)
- Guided setup wizard / tooltip tour (deferred — section empty states chosen for V1)
- Full-page trial expiry screen (deferred — inline lock chosen for V1)

</deferred>

---

*Phase: 1-Foundation*
*Context gathered: 2026-08-26*
