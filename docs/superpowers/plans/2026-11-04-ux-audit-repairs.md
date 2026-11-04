# UX Audit Repairs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the eight findings in `/tmp/opencode/outbound-ux-audit/report.md` while preserving draft-only outbound safety.

**Architecture:** Keep the existing shared shell and service/API patterns. Use server-rendered inbox routes, a client-side draft editor backed by a workspace-scoped prospect `custom_fields.outreachDraft` object, shared formatting helpers, and responsive CSS rather than adding a schema migration. No endpoint in this slice sends mail.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Drizzle/Postgres, Tailwind v4 CSS, Playwright/axe.

**Spec:** `/tmp/opencode/outbound-ux-audit/report.md`; canonical constraints in `TAXONOMY.md` and `BUILD-PLAN.md`.

## Global Constraints

- Saving a draft must never send or enqueue email.
- Drafting is allowed at `NEW` and without a contact email.
- Do not run seeds, migrations, provider calls, or sending jobs.
- Use canonical taxonomy labels and workspace timezone formatting.
- Keep every route usable at 390px and WCAG 2.1 AA.

## Review Focus

- Unknown-sender replies must still open without a prospect.
- Missing email must not block draft saving.
- Prospect names and dashboard reply links must not produce 404s.
- Long subjects/emails must wrap without page overflow.
- Settings labels must expose accessible names without changing saved values.

---

### Task 1: Lock audited failures with browser tests

**Files:**
- Create: `tests/e2e/ux-audit.spec.ts`

**Interfaces:**
- Consumes: local demo sign-in and seeded read-only records.
- Produces: assertions for navigation, inbox detail, responsive overflow, headings, settings labels, and draft-only controls.

- [ ] Write failing tests for the eight audit findings at desktop and 390px.
- [ ] Run `npm run test:e2e -- tests/e2e/ux-audit.spec.ts --workers=1` and confirm failures.

### Task 2: Restore Inbox task completion

**Files:**
- Modify: `app/(app)/inbox/page.tsx`
- Modify: `app/(app)/inbox/[id]/page.tsx`
- Modify: `app/(app)/dashboard/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `listInbox(ctx)` and `getReply(ctx, id)` from `lib/services/replies.ts`.
- Produces: semantic `/inbox/[id]` links and responsive reply cards/detail.

- [ ] Make list rows open reply detail and remove the inert New reply action.
- [ ] Render sender, subject, body, prospect context, outcome, and friendly received time in the detail route.
- [ ] Update dashboard links to `/inbox/[id]` and make mobile list/detail layouts overflow-free.
- [ ] Run the focused Inbox tests until green.

### Task 3: Add safe saved drafts

**Files:**
- Create: `components/outreach-draft-editor.tsx`
- Create: `app/api/prospects/[id]/draft/route.ts`
- Modify: `lib/services/prospects.ts`
- Modify: `app/(app)/outreach/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Produces: `getOutreachDraft(ctx, prospectId)` and `saveOutreachDraft(ctx, prospectId, input)`; persisted shape `{ subject, body, offerId, updatedAt, updatedBy }` under `custom_fields.outreachDraft`.
- Guarantees: no message row, enrollment, job, or provider call is created.

- [ ] Build a prospect picker and draft editor with explicit “Draft · not sent” status.
- [ ] Accept NEW prospects and empty recipient email; require only subject and body to save.
- [ ] Persist via the dedicated draft route with success/error feedback.
- [ ] Remove manual-send controls from the prospect drawer Emails tab.
- [ ] Run intercepted-request E2E tests proving Save draft never calls a sending endpoint.

### Task 4: Unify headings, labels, dates, and formatting

**Files:**
- Create: `lib/format.ts`
- Modify: `components/nav-meta.tsx`
- Modify: `app/(app)/sources/page.tsx`
- Modify: `app/(app)/library/page.tsx`
- Modify: `app/(app)/reports/page.tsx`
- Modify: `app/(app)/settings/page.tsx`
- Modify: `app/(app)/dashboard/page.tsx`
- Modify: `components/prospect-drawer.tsx`

**Interfaces:**
- Produces: `formatWorkspaceDate(value, timezone)` and `plainMarkdown(value)` helpers.

- [ ] Apply the shared `PageHeader` so each top-level page has one H1.
- [ ] Rename the visible Library title/metadata to Offers and map `/settings` to Settings.
- [ ] Format ISO dates and canonical enum labels for humans; strip supported Markdown emphasis markers from card summaries.
- [ ] Associate Settings labels and descriptions with form controls.
- [ ] Run heading/accessibility tests until green.

### Task 5: Responsive polish and final verification

**Files:**
- Modify: `app/globals.css`
- Modify: `BUILD_PROGRESS.md`

**Interfaces:**
- Consumes all preceding route/component changes.

- [ ] Constrain Dashboard chart children and cards so document width never exceeds viewport width.
- [ ] Verify desktop, tablet, and 390px screenshots in both themes.
- [ ] Run `npm run typecheck`, `npm run fmt:check`, `npm test -- --workers=1`, and `NEXT_DIST_DIR=.next-ui-build npm run build`.
- [ ] Record evidence and remaining limitations in `BUILD_PROGRESS.md`.
