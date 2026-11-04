# Outbound OS — Build Plan

Internal cold-outbound and prospecting platform for a 2–10 person agency.
Stack: Next.js 15 · TypeScript · Tailwind v4 · shadcn/ui · Postgres 16 (Supabase) · Drizzle · Auth.js · Apify · Resend · IMAP. Deployed on Vercel from a GitHub repo, with schema migrations run by GitHub Actions.

**Files in this folder**
- `BUILD-PLAN.md` — this document (sections A–D).
- `ONE-SHOT-BUILD-PROMPT.md` — the paste-ready build prompt (section E). Hand this to the coding agent.
- `TAXONOMY.md` — canonical enums, seed data, gates, and status transitions. Must be read by the build agent alongside the prompt.

**Revision 2** — rebuilt around the prospect taxonomy. Changes from Revision 1:
1. `leads` → **`prospects`** as the single domain entity; email health split into a separate `contactability` axis.
2. Taxonomy (Industry / Business Type / Size / Geography / Opportunity / Service / Fit / Priority / Role / Stage) is now first-class, filterable, and rule-evaluable.
3. **Research / Qualification / Enrollment gates** added and enforced server-side, with a live checklist in the UI.
4. Stage transition matrix with audit logging; system-driven transitions on send/reply/bounce.
5. **CSV import promoted to MVP** (async batch job, not a blocking request).
6. **Tags** added as a real entity (`tags` + `prospect_tags`) — the list filter and bulk action depend on it.
7. Async/limit realities fixed: CSV import and Apify test runs no longer assume a 60-second HTTP request.

**Revision 3** — hosting locked to GitHub → Vercel + Supabase Postgres + Drizzle:
1. Neon replaced by Supabase; runtime uses the transaction pooler (`:6543`, `prepare: false`, `max: 1`), migrations use the direct URL (`:5432`).
2. `citext` removed — normalized email columns are `text` with `check (col = lower(col))`, keeping the schema portable.
3. Migrations move to GitHub Actions on `main`, written expand/contract; Vercel builds never migrate.
4. Supabase Auth / Storage / Realtime / PostgREST explicitly out of scope; Data API disabled and RLS deny-all if ever enabled.
5. Added `.github/workflows/{ci,migrate}.yml` to the structure and a preview-DB strategy (Supabase branch or throwaway schema).

---

## A. INTERPRETED PRODUCT

**Outbound OS** is a private, multi-user web app for a small agency that turns cold outbound into a repeatable pipeline. It replaces the current patchwork (Apify console → spreadsheet → inbox → memory) with one system laid on top of a **structured prospect record**.

The product has four layers:

1. **Prospect taxonomy** — a fixed, opinionated classification model: Industry → Business Type → Company Size, geography, Opportunity, Potential Service, Fit, Priority, Contact, and an 11-stage sales pipeline. This is the backbone: everything else is filtering, qualification, or action against these fields.
2. **Source** — reusable lead sources wrapping Apify actors, run on demand or on schedule, with JSON-Schema-driven input, field mapping into the taxonomy, and dedupe on import. A CSV importer uses the same pipeline for existing prospect data.
3. **Qualify** — a deterministic rule engine scores prospects against saved ICP presets and a hard **research/qualification gate** that stops unresearched records from entering outreach.
4. **Outbound** — offers, templates, multi-step sequences, throttled sending through the agency's own domain, open/click tracking, reply detection, one inbox, and auto-stop on reply.

Two orthogonal axes are kept deliberately separate: **pipeline stage** (New → … → Won/Lost) and **contactability** (OK / Bounced / Unsubscribed / Do-not-contact). A prospect can be in Follow-up and still be un-emailable without those facts corrupting its pipeline position.

Scale: 5–10 seats, ~50k prospects, single workspace (all tables workspace-scoped).

---

## B. ASSUMPTIONS

| # | Assumption | Rationale |
|---|---|---|
| 1 | One workspace, 3–10 users; every table carries `workspace_id` so multi-tenancy is later a config change. | Cheap insurance for "possible live deployment". |
| 2 | The entity is called a **prospect** everywhere (table, API, UI). No separate "lead" object. | Matches the supplied taxonomy; nothing is built yet, so no migration cost. |
| 3 | Google OAuth + email magic link with an allowlist. No self-signup, no passwords. | Internal tool. |
| 4 | One primary contact per prospect in v1 (`contact_*` columns), because sequences send to one address. Multiple contacts = V2. | Matches the supplied record shape. |
| 5 | Email sends via **Resend** on a verified domain; replies via **IMAP polling** of the reply-to mailbox. Per-user Gmail/Outlook OAuth = V2. | Delivers "direct email integration" without two OAuth mail providers. |
| 6 | Qualification = deterministic rules over taxonomy fields + the gate. No AI in v1. | Auditable rejections; no extra paid dependency. |
| 7 | Apify actors are configured by actor ID + JSON-Schema form, never per-actor code. | One integration serves every actor. |
| 8 | Apify token, Resend key, IMAP credentials stored per workspace, AES-256-GCM encrypted. | Rotate secrets without redeploy. |
| 9 | Background work = DB job queue drained by a 60s Vercel Cron. No Redis, no worker service. | 10 users don't justify queue infra. |
| 10 | CSV import is **in MVP**, because the taxonomy implies an existing prospect database that must be loaded on day one. Same validation/dedupe/qualification pipeline as Apify. | Without it the tool starts empty. |
| 11 | Tracking = open pixel + click redirect, both toggleable per workspace. | Standard cold-email feature set. |
| 12 | Compliance: unsubscribe on every email, suppression list, quiet hours, daily caps, role-address block. | Deliverability + legal safety. |
| 13 | Deploy: GitHub repo → Vercel (auto-deploy) + **Supabase Postgres** + Resend + Apify. Node 20+, pnpm. No Docker. | Fewest moving parts; Supabase is plain Postgres, so nothing in the data model depends on it. |
| 14 | All scheduling uses the workspace timezone (default `Europe/Zurich`). | Single clock for send windows. |
| 15 | "Potential Service" is a classification field, not a catalogue with prices. Offers remain the sellable asset library; services can be linked to offers. | Keeps taxonomy descriptive, offers commercial. |
| 16 | `Next Action` + `Follow-up Date` are expected once a prospect moves past `Contacted`; a missing one is **flagged red in the list and counted in "Follow-ups due"** — never a hard block on saving or transitions. | A pipeline without a next action is a list, not a pipeline; nagging beats blocking. |
| 17 | Business types are user-extensible; industries are a fixed 17. | Exactly as specified in the taxonomy. |
| 18 | Any operation over ~2,000 rows (CSV import, dataset import, export) runs as a **job**, not inside the HTTP request. | Vercel functions time out; a 20k-row import will never finish in 60s. |
| 19 | Apify "test with 1 item" sets `maxDuration = 120` on its route and requires a Vercel **Pro** plan. On Hobby, the wizard falls back to an async preview run with polling. | A 1-item scrape regularly takes 30–90s; Hobby caps functions at 60s. |
| 20 | Tags are free-text labels (workspace-scoped, auto-created on first use), not a nested hierarchy. | Enough for "warm", "Q1-UK", "referral"; no tagging taxonomy needed. |
| 21 | App runtime connects through the **Supabase pooler** (`aws-0-<region>.pooler.supabase.com:6543`, transaction mode) with `postgres-js` and `prepare: false`; migrations use the **direct** connection (`:5432`). | Serverless functions would exhaust direct connections; transaction pooling forbids prepared statements. |
| 22 | Schema migrations run in **GitHub Actions on merge to `main`**, never in Vercel's build step, and are written **expand/contract** (add nullable → deploy → backfill → enforce). | Three parallel builds would race; migrate-then-deploy is not atomic. |
| 23 | Supabase **Auth, Storage, Realtime and the Data API (PostgREST) are not used**; RLS is disabled or deny-all. Tenancy is enforced by `workspace_id` in the service layer, and the service-role key never leaves the server. | Avoids two competing identity systems and a second, unused access path. |
| 24 | Supabase free tier pauses the project after ~1 week of inactivity (first request then takes ~10s). Production runs on Pro. | Predictable cron and sending behaviour. |

No blockers.

---

# C. COMPLETE BUILD PLAN

## 1. Product Overview

A user picks a saved source (Apify actor + input preset + field mapping + qualification rule) or imports a CSV, and the system creates prospect records at stage `NEW`, normalized and deduplicated, with size derived from scraped employee counts and industry/type inferred where possible. A researcher then completes the classification block in the prospect drawer, guided by a live gate checklist, and promotes the record to `RESEARCHED` and `QUALIFIED`. Qualified prospects are enrolled in a multi-step sequence built from offers and templates. The system sends within configured windows and caps, tracks engagement, detects replies, auto-advances the pipeline stage, and presents replies in one inbox with full history.

Why: the team currently loses hours moving CSVs between tools, re-sending to people who already replied, working from inconsistent classification, and has no single answer to "what do we know about this business, what did we send, and what happened?"

## 2. Product Goals

- Load and classify a prospect in under 2 minutes of human effort once the source runs.
- Every prospect carries a consistent Industry / Business Type / Size / Location / Opportunity / Service classification.
- Zero unresearched prospects enter outreach (gate enforced server-side).
- Zero duplicate cold emails to the same address across all sequences.
- 100% of replies auto-stop the sequence within 5 minutes.
- One screen answers, per prospect: classification, gate status, every email, every reply, next action.
- Build a new 3-step sequence in under 10 minutes.

## 3. Non-Goals (v1)

No multiple contacts per company, no CRM opportunity/deal values, no inbound forms, no dialer, no LinkedIn automation, no AI copywriting or AI classification, no per-user Gmail OAuth, no billing, no public signup, no mobile app, no kanban board (stage counts only), no A/B testing, no multi-workspace switcher, no custom fields beyond `custom_fields` JSONB.

## 4. Target Users

| User | Need |
|---|---|
| Agency owner | Configure sources and keys, run scrapes, own the taxonomy and ICP rules, watch deliverability and pipeline. |
| Outbound operator (2–3) | Classify prospects, build/launch sequences, work replies, advance stages, keep next actions current. |
| Occasional collaborator | Read prospects and sequences, add notes, cannot send or change keys. |

## 5. User Roles

| Capability | OWNER | ADMIN | MEMBER |
|---|---|---|---|
| Workspace settings, keys, sending domain | ✅ | ✅ | ❌ |
| Invite/remove users, change roles | ✅ | ❌ | ❌ |
| Hard-delete prospects / workspace data | ✅ | ❌ | ❌ |
| Manage business types; rename industries | ✅ | ✅ | ❌ |
| Sources, scrapes, qualification rules | ✅ | ✅ | ✅ |
| CSV import | ✅ | ✅ | ✅ |
| Classify / advance / edit prospects | ✅ | ✅ | ✅ |
| Gate override with reason | ✅ | ✅ | ❌ |
| Offers, templates, sequences (draft) | ✅ | ✅ | ✅ |
| Activate/pause sequences | ✅ | ✅ | ❌ |
| Enroll, send | ✅ | ✅ | ✅ (own daily cap) |
| Inbox / replies | ✅ | ✅ | ✅ (own + unassigned) |
| Suppression writes | ✅ | ✅ | ❌ |
| Audit log | ✅ | ✅ | ❌ |

Rules: exactly one OWNER (transfer required before removal). Removing a user reassigns their unread replies and owned prospects to the OWNER.

## 6. Core User Flows

### Flow 1 — First-run setup
- **Entry:** first OWNER login → `/setup`.
- **Actions:** paste Apify token → Test (`GET /v2/users/me`); Resend key + sending domain + from-name + reply-to → Test (`GET /v2/domains`, domain must be present and verified); IMAP host/port/user/password → Test (connect, open INBOX, logout).
- **System:** validates, encrypts, sets `verified_at`; feature areas stay locked until the relevant integration is green.
- **Success:** all green → `/dashboard`.
- **Failure:** invalid token → inline provider message, value retained, secret never logged; >10s → "Could not reach provider, retry".
- **Exit:** `/dashboard`.

### Flow 2 — Create a lead source and run it
- **Entry:** Sources → "New source".
- **Step 1 Identity:** name, description, actor via `GET /v2/store?search=` or pasted actor ID.
- **Step 2 Input:** fetch actor `inputSchema`, render a schema-driven form, save as `input_defaults`; unsupported nodes → validated raw JSON editor.
- **Step 3 Mapping:** detected output fields → taxonomy targets (business_name, website, email, first/last name, role, phone, linkedin, city, region, country, industry, business_type, employee_count, category). Auto-guess heuristics; unmapped → `custom_fields`.
- **Step 4 Classification preset:** optional default industry / market / primary opportunity applied to every imported prospect (so scraped records arrive half-classified), plus a qualification rule.
- **Step 5 Review:** summary + schedule (off/daily/weekly at HH:mm).
- **Run now:** creates `source_runs` + `APIFY_START`; Sources list shows a live status chip.
- **System:** start → store `apify_run_id` → poll every 20s → import in 1000-item pages → normalize → validate → dedupe → classify → insert.
- **Success:** run detail "412 items · 380 imported · 24 duplicates · 8 invalid · 96 qualified".
- **Edge:** actor failure → `FAILED` + raw error + "Open in Apify". >45 min → abort + `FAILED(timeout)`. Zero items → `IMPORTED` with input guidance.
- **Exit:** run detail → "View imported prospects" (filtered by `source_run_id`).

### Flow 3 — Research and qualify a prospect
- **Entry:** `/prospects` filtered to `stage = NEW`, or the dashboard "Research queue".
- **Actions:** open the drawer → Research tab shows the classification form and a **gate checklist** (industry, business type, size, ≥1 real opportunity, fit, country, contact name, role). Fill it in; opportunities are chip multi-selects; "Suggest services" pre-fills from the opportunity map.
- **System:** recomputes the checklist live; enables "Mark researched" when the research gate passes; "Qualify" additionally requires fit ∈ {Strong, Good}, ≥1 service, priority High/Medium, email present, contactability OK.
- **Success:** stage advances, event logged, next prospect auto-opens in the queue (if the user came from the queue).
- **Failure:** gate incomplete → button disabled with the remaining items listed; save still allowed (partial classification permitted at `NEW`).
- **Override (ADMIN+):** "Qualify anyway" modal requires a reason (≥10 chars), audit-logged, badge shown on the record. Only the qualification gate can be overridden — the research gate is data completeness and is never overridable.
- **Exit:** drawer closes or advances to the next prospect.

### Flow 4 — CSV import of an existing prospect database
- **Entry:** Prospects → "Import CSV".
- **Step 1 Upload/paste:** file ≤10MB / 20k rows; header row required.
- **Step 2 Map:** each CSV column → taxonomy field (auto-guessed by header name); enum columns accept slug or human label (case-insensitive, fuzzy offers suggestions); unmatched columns → `custom_fields` or ignore.
- **Step 3 Preview:** dry-run table of the first 20 mapped rows + validation summary (valid / invalid with reasons / duplicate candidates / suppressed).
- **Step 4 Import:** chunked inserts in the same pipeline as Apify. Defaults: stage `NEW`, priority `MEDIUM`, fit `UNKNOWN`, opportunity `UNKNOWN` unless mapped.
- **Success:** report screen with counts + downloadable error CSV.
- **Edge:** duplicate email → merged, counted. Same domain, different email → flagged as duplicate candidate, not blocked. Unknown enum value → row error unless the mapper coerces it. Rows > 20k → rejected with guidance to split.
- **Exit:** report → "View imported prospects".

### Flow 5 — Enroll prospects into a sequence
- **Entry:** `/prospects`.
- **Actions:** filter, select rows or "select all filtered" (max 5,000), "Enroll in sequence".
- **Modal:** sequence + sender + preflight: `380 selected → 312 eligible → 68 skipped (41 contacted, 12 suppressed, 9 in another sequence, 6 no email)` with an inspection link.
- **System:** enforces the enrollment gate server-side, creates enrollments, computes `next_send_at`, enqueues sends.
- **Success:** toast "312 prospects enrolled" + link to sequence detail.
- **Edge:** sequence not active → blocked; all ineligible → disabled with reason; concurrent enroll → partial unique index wins, reported as skipped (no 500).
- **Exit:** sequence detail.

### Flow 6 — Build and launch a sequence
- **Entry:** Sequences → "New sequence".
- **Builder:** name → Step 1 (template or inline subject/body, merge-field autocomplete, live preview on a sample prospect) → "Add step" (delay in business days, default 3) → window/caps (from settings) → Save draft.
- **Activate:** requires ADMIN+, ≥1 step, all steps renderable, verified domain, no archived template references. Warns on >4 steps or gaps <2 business days.
- **System:** `ACTIVE`; sends begin at each enrollment's `next_send_at`.
- **Success:** "312 enrolled · 118 sent · 27 replied · 211 pending".
- **Exit:** sequence list.

### Flow 7 — Reply handling
- **Entry:** IMAP sync every 5 min, or `/inbox`.
- **System:** fetch new messages since the last UID; match `In-Reply-To`/`References` → `messages.message_id_header`, else `From` → prospect email. On match: create reply, stop the enrollment (`replied`), delete queued sends, set stage → `REPLIED` (unless already Meeting/Proposal/Won/Lost), notify assignee. Unsubscribe intent → suppression + stop + contactability `UNSUBSCRIBED`. OOO → no stop, next step +2 business days (max 2 pushes).
- **User:** reply (via Resend, logged as manual message), set outcome (`positive/neutral/negative/not_interested/out_of_office`), set/refresh Next Action + Follow-up Date, advance stage.
- **Success:** unread → 0; timeline complete; stage correct.
- **Edge:** unmatched sender → "Unknown sender" item with Link / Create prospect / Ignore.
- **Exit:** inbox.

### Flow 8 — Weekly pipeline hygiene
- **Entry:** dashboard "Follow-ups due" widget (overdue first) and "Research queue" count.
- **User:** clears overdue next actions, reclassifies stale `NEW` prospects, archives `LOST`/`DISQUALIFIED`, reviews the deliverability panel (bounce rate >3% banner).
- **Exit:** dashboard.

## 7. Feature Specification

**7.1 Authentication** — Auth.js magic link + Google, JWT 30-day rolling. Non-allowlisted → "This workspace is invite-only." Removal bumps `session_version`. All `/api/*` require a session except webhooks, tracking, unsubscribe, cron, health.

**7.2 Taxonomy** — enums and seeds exactly as in `TAXONOMY.md`. `business_types` table is editable (ADMIN+): create (label + industry), rename, archive (blocks if in use; offers a bulk reassignment to another type). Industries fixed; rename only. Opportunities, services, roles, quality, size, fit, priority, stage are fixed enums. A Settings → Taxonomy tab lists all of them with usage counts.

**7.3 Dashboard** — row 1: 4 stat cards (Prospects total / New this week, Research queue, Emails sent 7d + reply rate, Follow-ups due). Row 2: pipeline strip of 11 stage counts (clickable → filtered list). Row 3: 30-day sent/replies chart. Row 4: last 5 runs (60%) + last 5 replies (40%). Empty state = onboarding checklist (connect Apify → import or scrape → classify → build sequence). No websockets; server-rendered on load; per-widget error retry.

**7.4 Sources** — table (name, actor, last run, imported, schedule, actions Run/Edit/Duplicate/Archive). Delete with runs → archive only.

**7.5 Run detail** — status pill, actor link, timings, counters (fetched/imported/duplicate/invalid/qualified/disqualified), error block, tabs: Imported prospects / Skipped (reason per row) / Raw sample (5 items). Actions: Cancel, Retry, Import again (idempotent per `source_run_id`).

**7.6 CSV import** — as Flow 4. Preview parses only the first 200 rows synchronously. The import itself runs as an `IMPORT_BATCH` job (batches of 500 rows, progress counters polled by the UI), persists the `import_batches` row with mapping, counts, and the error report, and can be re-run from the same stored mapping. Users can leave the page; a completion notification follows.

**7.7 Normalization** — trim + lowercase email; RFC-5322-lite regex; reject role prefixes (info, sales, support, admin, hello, contact, office, noreply, billing, jobs) unless the source allows; optional MX check with 24h `dns_cache`; normalize website to https URL and extract `domain_normalized`; derive `company_size` from `employee_count` (band by upper bound) only when size is unset; parse country names/codes to ISO alpha-2 via a static map; strip UTM params; truncate lengths (business_name 200, email 320, name 120, city/region 120, market 60, notes 20k); derive `contact_name` as "first last" from `contact_first_name`/`contact_last_name` (authoritative) on save.

**7.8 Dedupe/merge** — hard unique on `(workspace_id, email_normalized)` where email is present and `deleted_at is null`. Same `domain_normalized` with a different email → **duplicate candidate** flag, not blocked. On conflict: fill only empty fields, append provenance, never change stage/history. Tombstoned emails → skipped `previously_deleted`. Manual merge (ADMIN+): pick a primary, choose field-level winners, move enrollments/messages/replies/notes, soft-delete the loser.

**7.9 Qualification rule engine** — rule = `match` ALL/ANY over conditions `{field, operator, value, weight}`. Fields: business_name, industry, business_type, company_size, city, region, country_code, market, opportunity (list), service (list), fit, priority, contact_role, contact_quality, website, domain, source, `custom.<key>`. Operators: equals, not_equals, contains, not_contains, starts_with, ends_with, is_empty, is_not_empty, gt, lt, in_list, not_in_list, regex (ci, 200ms guard). List fields use intersects/not-intersects semantics for `in_list`. Missing → comparisons fail, `is_empty` passes. Score = normalized weighted sum 0–100 (negative weights allowed). Verdict pass → `fit` suggestion + `priority` suggestion (rule may set neither; it only *recommends*, and the recommendation is shown in the drawer). Rules are versioned; prospects store the revision applied. Tester endpoint evaluates raw JSON rows or existing prospects with per-condition results.

**7.10 Prospects table** — server-paginated (25/50/100), URL-synced filters: search (business name / domain / contact name / email), stage (multi), industry, business type (dependent on industry), company size, country / region / city / market, opportunity (multi), service (multi), fit, priority, contact quality, contactability, has email, gate status (ready to qualify / incomplete), owner, tag, follow-up due (overdue / today / this week). Columns: business + domain, industry/type, location, size, stage, fit, priority, contact, next action + due date, last contact. Bulk actions: enroll, stage change, priority, fit, add tag, assign owner, suppress, delete (OWNER), export CSV (≤50k, queued job with a download link). Bulk stage change runs through the same transition service (matrix, gates, closed_reason, audit); per-row failures are reported, never a 500. Row → drawer. Mobile: card list + filter sheet + sticky bulk bar.

**7.11 Prospect detail drawer** — 5 tabs:
- **Overview:** identity, geography, stage with transition menu, fit/priority, contactability badges, next action + follow-up date, owner, tags, source provenance with run link, gate checklist summary, "Suggest services", duplicate-candidate warning with Merge action.
- **Research:** full classification form (industry → business type dependent select, size, geography, opportunities chips, services chips with suggestions, fit, priority, contact fields incl. role + quality), gate checklist, Save, "Mark researched", "Qualify".
- **Timeline:** every event — imported, classified, gate passed, enrolled, sent, opened, clicked, replied, bounced, unsubscribed, stage change (from/to/actor/reason), notes added, merged.
- **Emails:** every message with subject, status, timestamps, rendered body.
- **Notes:** append-only markdown with author + timestamp.

**7.12 Offers** — name, summary, value prop (markdown), price text, constraints, linked services (from the taxonomy), active. Deletion blocked while referenced by a template.

**7.13 Templates** — name, subject ≤150, body markdown ≤8000, optional offer, category. Merge fields: `{{business_name}} {{first_name}} {{last_name}} {{contact_name}} {{role}} {{city}} {{region}} {{country}} {{industry}} {{business_type}} {{company_size}} {{market}} {{website}} {{custom.<key>}}`. Fallbacks: `first_name`/`contact_name` → "there" when absent, others → "". Unknown custom key → empty + non-blocking warning. Preview renders for a chosen prospect in a sandboxed iframe. Spam-word warning (informational).

**7.14 Sequences** — CRUD + builder; step = template or inline override, delay 0–30 business days. States DRAFT/ACTIVE/PAUSED/ARCHIVED. Pause cancels queued sends. Archive requires no active enrollments. Stats: enrolled/sent/opened/clicked/replied/bounced/completed/stopped.

**7.15 Enrollment** — preflight returns eligible + reason counts for each exclusion (wrong stage, low priority, poor fit, suppressed, bounced, unsubscribed, no email, in another active sequence, gate incomplete, do-not-contact). Enroll inserts eligible rows, sets `current_step = 0`, `next_send_at` = next window start, enqueues `SEND_STEP`. 5,000 cap per action. Concurrent enroll → partial unique wins, reported as skipped.

**7.16 Sending** — `SEND_STEP` re-validates at execution: sequence ACTIVE, enrollment ACTIVE, prospect not suppressed/bounced/unsubscribed/do-not-contact, stage not Won/Lost/Disqualified, no email in the last 24h, under the effective daily cap — min(daily_send_cap per user, 5 × days since the sending-domain credential was verified, full volume from day 10) — and 60/hour/workspace, inside Mon–Fri 09:00–17:00 workspace TZ (else reschedule to next window). Render → text + minimal HTML → unsubscribe footer + pixel + click rewriting → Resend with `reply_to` and `List-Unsubscribe` (+`-Post`) headers, generated `Message-ID`. On success: message SENT, **stage NEW→…→CONTACTED** (first send) and **CONTACTED→FOLLOW_UP** (step ≥2), advance step, next `next_send_at` = +delay business days at window start + 0–90 min jitter; exhausted → COMPLETED. Failures: 429 → +5 min; invalid address → permanent FAILED + contactability BOUNCED; 5xx → retry 1m/5m/15m then FAILED + STOPPED(send_failed).

**7.17 Tracking** — HMAC-signed `messageId:type` tokens. `/api/track/o/{token}.gif` sets `opened_at`/`open_count`; `/api/track/c/{token}` validates the target is http(s) and not the app host, then 302s. `/u/{token}` unsubscribe page works logged out: confirm → suppression (UNSUBSCRIBED), contactability UNSUBSCRIBED, stop all active enrollments. Stage is **not** changed by unsubscribe. Open counts are indicative only (Apple MPP prefetch inflates them); Reports footnotes this.

**7.18 Webhooks** — `POST /api/webhooks/resend` with Svix signature verification: delivered→DELIVERED; hard bounce→BOUNCED + suppression(HARD_BOUNCE) + contactability BOUNCED + stop enrollment (stage unchanged); complaint→COMPLAINED + suppression(COMPLAINT) + contactability DO_NOT_CONTACT + stop. Idempotent by provider event id.

**7.19 Replies** — cron every 5 min: fetch after the last UID (≤200/cycle; store UIDVALIDITY and re-key when it changes), decode UTF-8 with latin-1 fallback, match threading headers then sender, create reply, stop enrollment, set stage REPLIED (guarded), set contact quality VERIFIED on reply (a human answered), notify assignee. OOO detection delays instead of stopping. IMAP failures set `last_error` and a banner; sending continues.

**7.20 Inbox** — two panes; filters unread/mine/unassigned/outcome/date; actions reply, read/unread, assign, outcome, set next action + follow-up date, advance stage, suppress, link/create prospect, ignore.

**7.21 Suppression** — list with reason (unsubscribed/hard_bounce/complaint/manual/invalid), source, date, actor. Add single or CSV paste, export, delete (ADMIN+). Consulted at send time and at enrollment.

**7.22 Settings** — Workspace (name, TZ, window, caps, tracking toggles, footer text) · Integrations · Taxonomy (business types + usage counts) · Team · Suppression · Audit (paginated, filterable).

**7.23 Jobs** — `POST /api/cron/tick` (60s, `x-cron-secret`), `FOR UPDATE SKIP LOCKED`, ≤20/cycle, retry `2^attempts` minutes, DEAD after 5, surfaced on a dashboard health widget. Types: APIFY_START, APIFY_POLL, APIFY_IMPORT, SEND_STEP, IMAP_SYNC, SCHEDULE_SOURCE, IMPORT_BATCH. Idempotent via `dedupe_key`.

**7.24 Notifications** — in-app bell: reply assigned to you, run failed, follow-up due, sequence completed, cap reached, duplicate candidate detected.

## 8. UI/UX Specification

**Information architecture**

```
/                        → /dashboard
/dashboard
/prospects               → list | /prospects/[id] (drawer desktop, page mobile)
/prospects/import        → CSV wizard
/sources                 → list | /sources/new | /sources/[id]
/runs                    → list | /runs/[id]
/sequences               → list | /sequences/[id]
/inbox                   → list | /inbox/[id]
/library                 → tabs Offers | Templates
/reports                 → pipeline + deliverability + source yield
/settings                → tabs Workspace | Integrations | Taxonomy | Team | Suppression | Audit
/setup
/u/[token]
```

**Shell** — desktop: 248px sidebar (Dashboard, Prospects, Sources, Runs, Sequences, Inbox [badge], Library, Reports; bottom Settings + user menu) + 56px topbar (title, ⌘K palette, notifications, avatar). Tablet 768–1023: 64px icon rail with tooltips. Mobile <768: hamburger drawer + bottom tabs (Dashboard, Prospects, Inbox, More).

**Screens**

- **Dashboard** — stat cards (2×2 tablet), pipeline strip, chart, runs + replies. Primary "New source", secondary "Import CSV".
- **Prospects** — header with count + "Import CSV" + "New prospect"; toolbar with the filter set above (advanced filters in a popover); active-filter chips; bulk bar on selection; 52px rows (two-line business cell); stage badge + fit/priority micro-badges; overdue next action shown in red. Empty-per-filter state with Clear filters.
- **Prospect drawer** — right drawer 560px (full page on mobile), tabs as above; sticky footer on Research with Save / Mark researched / Qualify and the gate checklist summary.
- **CSV import — 4 steps with a mapping table, dry-run preview, and report.
- **Source wizard** — 5 steps; actor picker with pricing hint; dependent dropdowns for industry→business type; "Test (usually 30–90s)" spinner.
- **Sequence builder** — two columns ≥1280px (steps 60% / sticky preview 40%); stacked below; ↑↓ reorder.
- **Inbox** — 380px list + reading pane; mobile push detail; quoted original collapsed.

**Components specific to this product:** `GateChecklist` (list of requirements with ✓/✕, remaining count, live recompute), `TaxonomyPicker` (industry → dependent business type, size, country), `OpportunityChips` + `ServiceChips` with "Suggest services", `StageBadge`, `StageTransitionMenu` (offers only allowed transitions per `TAXONOMY.md`, asks for a reason when required), `PriorityBadge`, `ContactabilityBadge`, `PipelineStrip`, `FollowUpDueList`, `DuplicateCandidateBanner`.

**States:** skeletons on first paint, toasts 5s dismissible, inline field errors, page error boundary with Reload, typed confirmation only for workspace/hard deletes, `aria-live` for toasts and run status.

**Accessibility:** WCAG 2.1 AA, visible focus rings, keyboard-operable chips/selects/table, `aria-label` on icon buttons, ≥4.5:1 contrast, always-visible labels, focus-trapped modals with restore, `prefers-reduced-motion`.

## 9. Design System

- **Direction:** shadcn/ui + Tailwind, zinc/slate surfaces, accent violet-600. Semantic color only for status. Light + dark (system default, toggle in the user menu).
- **Type:** Geist Sans / Geist Mono. 12/14/16/18/20/24/30; weights 400/500/600; headings `tracking-tight`; table text 14.
- **Spacing:** 4px base (1,2,3,4,6,8,12,16,24). Page padding 24 desktop / 16 mobile. Card padding 16–20. Section gap 24.
- **Radius:** controls 8, cards/modals 12, pills 999. **Shadows:** `sm` cards, `lg` overlays, none on tables/inputs.
- **Buttons:** 32/36/40; default violet, secondary, outline, ghost, destructive, link; loading = spinner + disabled, label unchanged.
- **Inputs:** 36px, 1px zinc-300 border (zinc-700 dark), violet focus ring, red border + message on error, 12px muted helper text.
- **Selects:** shadcn Select; searchable Command above 8 options (required for business types and countries).
- **Chips:** rounded-full, 28px, removable ×, selected = violet tint.
- **Tabs:** underline, 36px, violet 2px active.
- **Cards:** border + `shadow-sm`, 12px, header 600.
- **Tables:** uppercase 12px muted header on `bg-muted/40`, row hover, horizontal borders only.
- **Badges:** stage NEW slate · RESEARCHED blue · QUALIFIED indigo · CONTACTED cyan · FOLLOW_UP amber · REPLIED violet · MEETING teal · PROPOSAL purple · WON emerald · LOST zinc-strike · DISQUALIFIED red outline. Fit: strong emerald, good teal, possible amber, poor red, unknown zinc. Priority: high red, medium amber, low zinc, disqualified red outline. Contactability: OK emerald, bounced red, unsubscribed amber, do-not-contact red.
- **Alerts:** info/warn/error/success, `role="alert"` on error. **Tooltips:** Radix 300ms. **Icons:** Lucide 16/20.
- **Modals:** 480 confirm / 640 form / 960 preview. **Drawer:** 560.
- **Breakpoints:** 640 / 768 / 1024 / 1280 / 1536.

## 10. Technical Architecture

**Frontend** — Next.js 15 App Router, TS strict, React 19, Tailwind v4, shadcn/ui, Lucide. Server components read the DB directly; mutations via REST handlers; TanStack Query for client fetching/polling. React Hook Form + Zod (shared schemas). List state in the URL. No global store. sonner toasts.

**Backend** — same deployment. Thin route handlers: auth → Zod → service → error mapping. Services in `lib/services/**` as `(ctx, input)` functions. Auth.js v5 (Google + magic link), JWT. Authorization: `requireUser`/`requireRole` + `db.scoped(workspaceId)`.

**Database** — PostgreSQL 16 on **Supabase**, Drizzle + drizzle-kit. Relational integrity, JSONB for actor payloads/rule conditions/custom fields, real unique constraints for dedupe. Runtime uses the Supabase pooler (transaction mode, `prepare: false`); migrations use the direct connection. No `citext` — normalized email columns are `text` with a `check (col = lower(col))` constraint, so the schema stays portable.

**Hosting & delivery** — GitHub is the source of truth; Vercel deploys `main` and every PR (preview). GitHub Actions runs `lint → typecheck → test → e2e` against a Postgres 16 service container, then, on `main`, `drizzle-kit migrate` against Supabase using a production environment secret. Vercel's deploy hook fires after the migration job succeeds. PR previews point at a Supabase branch database (or a throwaway schema) — never production.

**Storage** — none in v1. Exports stream from Postgres; CSV ≤10MB / 20k rows parsed in memory; import error CSVs stored as JSONB (≤1MB).

**External services**

| Service | Why | Out | In | Auth | Failure handling | Limits |
|---|---|---|---|---|---|---|
| Apify | Run scrapers, fetch datasets | actor id, input JSON | status, dataset items | Bearer | 429 backoff 60s×attempt; 5xx retry 3×; 45-min run timeout | 10 concurrent, 100 runs/day per workspace |
| Resend | Send email, webhooks | to/from/subject/html | message id, delivery/bounce/complaint | Bearer + Svix signature | 4xx permanent; 429 reschedule 5m; signature verified | 10 req/s (caps protect) |
| IMAP | Reply detection | UID fetch | headers + text | user/app password | retry ×3 then integration warning | poll 5 min, ≤200/cycle |
| Google OAuth | Login | — | email, name, avatar | OAuth 2.0 + PKCE | fall back to magic link | — |

## 11. Data Model

All tables: `id uuid pk`, `created_at`, `updated_at`; business tables carry `workspace_id` (FK cascade) and are indexed on it. **Directly queried tables** (`prospects`, `lead_sources`, `source_runs`, `import_batches`, `qualification_rules`, `offers`, `email_templates`, `sequences`, `enrollments`, `messages`, `replies`, `suppressions`, `tags`, `prospect_notes`, `prospect_events`, `jobs`, `audit_logs`) each store `workspace_id` explicitly. **Pure child tables** (`prospect_opportunities`, `prospect_services`, `prospect_tags`, `offer_services`, `sequence_steps`, `business_types`, `industries`) inherit scope through their parent — every query must join through it, and the service layer still asserts `workspaceId` on the parent before writing.

```
workspaces(name, timezone, send_window_start/end, daily_send_cap 50 (per-user), hourly_send_cap 60,
  track_opens, track_clicks, unsubscribe_footer, setup_completed_at)

users(email text unique check (email = lower(email)), name, role enum(OWNER,ADMIN,MEMBER),
  status enum(ACTIVE,INVITED,DISABLED), avatar_url, session_version)
accounts, sessions, verification_tokens            -- Auth.js

industries(slug pk, label)                          -- 17 seeded, rename-only
business_types(id, industry_slug fk, label, slug, is_system, archived_at)
  unique(industry_slug, slug)                     -- slug derived from label; avoids an expression index

integration_credentials(kind enum(APIFY,RESEND,IMAP), label, config jsonb,
  secret_ciphertext, secret_iv, secret_tag, verified_at, last_error)
  unique(workspace_id, kind)

lead_sources(name, description, actor_id, actor_name, input_defaults jsonb, mapping jsonb,
  default_industry, default_market, default_opportunity,
  qualification_rule_id, schedule enum(OFF,DAILY,WEEKLY), schedule_hour,
  verify_mx, allow_role_addresses, archived_at, last_run_at, created_by)

source_runs(source_id, apify_run_id unique, status enum(QUEUED,RUNNING,SUCCEEDED,FAILED,CANCELLED,IMPORTED),
  input jsonb, started_at, finished_at, items_fetched/imported/duplicate/invalid/qualified/disqualified,
  error jsonb, sample_items jsonb)

import_batches(kind enum(CSV), file_name, mapping jsonb, status enum(PREVIEW,RUNNING,DONE,FAILED),
  rows_total, rows_imported, rows_invalid, rows_duplicate, error_report jsonb, created_by)

prospects(
  business_name, website, domain_normalized,
  industry_slug fk, business_type_id fk, company_size enum(SOLO,MICRO,SMALL,SMALL_MEDIUM,MEDIUM,LARGE,UNKNOWN),
  employee_count int, city, region, country_code char(2), market,
  fit enum(STRONG,GOOD,POSSIBLE,POOR,UNKNOWN), priority enum(HIGH,MEDIUM,LOW,DISQUALIFIED),
  stage enum(NEW,RESEARCHED,QUALIFIED,CONTACTED,FOLLOW_UP,REPLIED,MEETING,PROPOSAL,WON,LOST,DISQUALIFIED),
  contactability enum(OK,BOUNCED,UNSUBSCRIBED,DO_NOT_CONTACT),
  contact_name, contact_first_name, contact_last_name, contact_role enum(...10),
  contact_email, contact_email_normalized text
    check (contact_email_normalized = lower(contact_email_normalized)),
  contact_phone, contact_linkedin,
  contact_quality enum(VERIFIED,UNVERIFIED,RISKY,BOUNCED,UNKNOWN),
  next_action text, follow_up_date date, closed_reason text,
  gate_override_reason text, qualification_rule_id, qualification_revision,
  source_id, source_run_id, owner_user_id, is_duplicate_candidate bool, custom_fields jsonb,
  last_contacted_at, last_reply_at, deleted_at)
  unique(workspace_id, contact_email_normalized) where contact_email_normalized is not null and deleted_at is null
  index(workspace_id, stage, created_at desc), (workspace_id, industry_slug), (workspace_id, follow_up_date),
        (workspace_id, domain_normalized), gin(custom_fields)

prospect_opportunities(prospect_id, opportunity enum(14), pk(prospect_id, opportunity))
prospect_services(prospect_id, service enum(15), pk(prospect_id, service))
tags(id, workspace_id, label, slug)              unique(workspace_id, slug)
prospect_tags(prospect_id, tag_id, pk(prospect_id, tag_id))   index(tag_id)
prospect_notes(prospect_id, body_md, author_user_id)
prospect_events(prospect_id, type, payload jsonb, actor_user_id, created_at)
deleted_emails(workspace_id fk, email_normalized, deleted_at)   unique(workspace_id, email_normalized)
suppressions(email_normalized text check (email_normalized = lower(email_normalized)),
  reason enum(UNSUBSCRIBED,HARD_BOUNCE,COMPLAINT,MANUAL,INVALID),
  source, note, created_by)   unique(workspace_id, email_normalized)

qualification_rules(name, description, match enum(ALL,ANY), conditions jsonb, revision, is_active, created_by)
offers(name, summary, value_prop_md, price_text, constraints, is_active)
offer_services(offer_id, service)                  -- optional service linkage
email_templates(name, subject, body_md, offer_id, category, archived_at)

sequences(name, description, status enum(DRAFT,ACTIVE,PAUSED,ARCHIVED), created_by)
sequence_steps(sequence_id, position, template_id, subject_override, body_override_md,
  delay_business_days default 3)   unique(sequence_id, position)
enrollments(sequence_id, prospect_id, status enum(ACTIVE,PAUSED,COMPLETED,STOPPED,FAILED),
  current_step, next_send_at, stop_reason, ooo_pushes, enrolled_by)
  unique(sequence_id, prospect_id)
  partial unique(workspace_id, prospect_id) where status = 'ACTIVE'
  index(status, next_send_at)

messages(enrollment_id, prospect_id, step_id, to_email, from_email, subject, body_md, html, text,
  provider, provider_message_id, message_id_header,
  status enum(QUEUED,SENT,DELIVERED,BOUNCED,COMPLAINED,FAILED), is_manual,
  open_count, click_count, sent_at, opened_at, clicked_at, error)
replies(prospect_id nullable, message_id, from_email, to_email, subject, body_text, snippet,
  received_at, imap_uid, imap_uidvalidity bigint, imap_folder, is_read, assigned_user_id,
  outcome enum(POSITIVE,NEUTRAL,NEGATIVE,NOT_INTERESTED,OOO))
  unique(workspace_id, imap_folder, imap_uidvalidity, imap_uid)

jobs(type, payload jsonb, status enum(PENDING,CLAIMED,DONE,DEAD), run_at, attempts, max_attempts,
  locked_at, locked_by, last_error, dedupe_key unique)
dns_cache(domain pk, has_mx, checked_at)
audit_logs(user_id, action, target_type, target_id, meta jsonb, ip, created_at)
```

**Invariants enforced in DB or service layer:** one ACTIVE enrollment per prospect · `priority = DISQUALIFIED` ⇒ `stage = DISQUALIFIED` and queued sends cancelled · `UNKNOWN` opportunity only at stage `NEW` · `LOST`/`DISQUALIFIED` require `closed_reason` · suppression and contactability checked at send time · no send within 24h per prospect · contiguous `sequence_steps.position` · business type must belong to the prospect's industry · hard delete → tombstone · messages/replies/events/audit append-only.

## 12. API Specification

JSON over session cookie. Errors: `{ error: { code, message, details? } }` → 400 validation (Zod), 401, 403, 404 (incl. cross-workspace), 409, 422 business rule, 429, 500.

| Method | Route | Purpose | Auth |
|---|---|---|---|
| GET | `/api/health` | liveness + db | public |
| POST | `/api/auth/*` | Auth.js | public |
| GET | `/api/dashboard` | stats + pipeline strip + follow-ups | any |
| GET | `/api/prospects` | list with the filter set | any |
| POST | `/api/prospects` | create (min: business_name) | any |
| GET | `/api/prospects/{id}` | detail + opportunities + services + events + messages + notes | any |
| PATCH | `/api/prospects/{id}` | fields, classification, owner, tags | any |
| DELETE | `/api/prospects/{id}` | soft delete + tombstone | OWNER |
| POST | `/api/prospects/{id}/stage` | transition `{to, reason?}` — validates allowed transitions + gates | any |
| POST | `/api/prospects/{id}/qualify` | gate-checked promote to RESEARCHED/QUALIFIED (`{override, reason}`) | ADMIN+ for override |
| POST | `/api/prospects/{id}/notes` | append note | any |
| POST | `/api/prospects/{id}/merge` | merge duplicates `{duplicateId, fieldWinners}` | ADMIN |
| POST | `/api/prospects/bulk` | enroll / stage / priority / fit / tag / owner / suppress / delete | role-checked |
| POST | `/api/prospects/export` | enqueue export job; returns `jobId` | any |
| GET | `/api/prospects/export/{jobId}` | job status + signed download link | any |
| POST | `/api/prospects/import/preview` | parse first 200 rows, dry-run mapping | any |
| POST | `/api/prospects/import` | create batch + enqueue `IMPORT_BATCH`, returns `batchId` | any |
| GET | `/api/prospects/import/{batchId}` | batch status + counters + error rows | any |
| GET | `/api/tags` | list workspace tags with counts | any |
| GET | `/api/taxonomy` | industries, business types (+usage), enums with labels | any |
| POST | `/api/taxonomy/business-types` · PATCH/DELETE `/{id}` | manage types | ADMIN+ |
| GET/POST | `/api/sources`, `GET/PATCH/DELETE /api/sources/{id}`, `POST /{id}/run` | sources | any |
| POST | `/api/sources/test-run` | 1-item test, ≤5 samples, 90s cap | any |
| GET | `/api/apify/actors`, `GET /api/apify/actors/{actorId}/schema` | actor proxy | any |
| GET | `/api/runs`, `GET /api/runs/{id}`, `POST /api/runs/{id}/{cancel,retry,reimport}` | runs | any |
| GET/POST | `/api/qualification-rules`, `GET/PATCH/DELETE /{id}`, `POST /test` | rules | any |
| GET/POST | `/api/offers`, `GET/PATCH/DELETE /{id}` | offers | any |
| GET/POST | `/api/templates`, `GET/PATCH/DELETE /{id}`, `POST /{id}/preview` | templates | any |
| GET/POST | `/api/sequences`, `GET/PATCH/DELETE /{id}`, `PUT /{id}/steps` | sequences | any |
| POST | `/api/sequences/{id}/activate` \| `pause` \| `preflight` \| `enroll` | transitions + enrollment | ADMIN+ activate |
| GET | `/api/enrollments`, `POST /api/enrollments/{id}/stop` | enrollments | any |
| GET | `/api/inbox`, `GET/PATCH /api/inbox/{id}`, `POST /api/inbox/{id}/reply` | inbox | any |
| GET/POST | `/api/suppressions`, `DELETE /api/suppressions/{id}` | suppression | ADMIN+ writes |
| GET/PATCH | `/api/settings` | workspace | ADMIN+ |
| GET | `/api/integrations`; `PUT/POST test/DELETE /api/integrations/{kind}` | credentials | ADMIN+ |
| GET | `/api/team`; `POST /api/team/invite`; `PATCH/DELETE /api/team/{id}` | team | OWNER |
| GET | `/api/audit` | paginated | ADMIN+ |
| GET | `/api/track/o/{token}.gif`, `/api/track/c/{token}` | tracking | HMAC token |
| GET/POST | `/u/{token}` | unsubscribe | token |
| POST | `/api/webhooks/resend` | provider events | Svix signature |
| POST | `/api/cron/tick` | drain jobs | `x-cron-secret` |

**Authorization:** `workspaceId` always from the session; every lookup includes it; secrets returned masked only (`••••1234` + `verified_at`).

## 13. Security

Auth.js v5, JWT 30-day, httpOnly/secure/sameSite=lax cookies, OAuth state + PKCE, magic links hashed + single-use + 15-min TTL, allowlist with generic failure message, `session_version` invalidation. Server-side authorization only, IDOR tests mandatory. Zod at every boundary; max lengths enforced; JSONB caps 1MB; no unknown keys on PATCH. Drizzle parameterized queries only; no raw SQL outside migrations; custom-field keys sanitized `[a-z0-9_]{1,40}`. Markdown → HTML with an element allowlist (`p,br,strong,em,ul,ol,li,a,h3,h4,blockquote`); previews in sandboxed iframes; CSP `default-src 'self'` + nonce, `img-src 'self' data: https:`. Same-origin `Origin` check on mutations; webhooks by signature. Rate limits 60 mutations/min/user, 10 concurrent + 100/day Apify runs/workspace, cron secret required. Secrets AES-256-GCM with `APP_ENCRYPTION_KEY`, never logged or returned, `server-only` imports. CSV ≤10MB / 20k rows. Supabase Data API (PostgREST) disabled for this project — if it is ever enabled, all tables get deny-all RLS and the anon key is never shipped to the client; the service-role key is server-only and distinct from the pooler connection credentials. Email safety: unsubscribe + `List-Unsubscribe` headers, suppression at send time, auto-suppress on bounce/complaint. Audit: sign-in/out, role changes, credential changes, taxonomy changes, gate overrides, stage changes, merges, suppression changes, hard deletes, sequence activate/pause, bulk actions, exports. Soft-deleted prospects purged after 30 days.

## 14. Edge Cases

| Situation | Behavior |
|---|---|
| No email on a scraped prospect | Record created (stage NEW) with contactability OK and no address; blocked from enrollment with reason `no_email`. |
| Item missing business name | Rejected into the run report (`missing_business_name`), never a prospect. |
| Same domain, different email | Duplicate-candidate flag + banner; not blocked. |
| Duplicate emails in one dataset | First wins, rest counted. |
| Prospect in an active sequence | Enroll skipped `already_active_sequence`. |
| Stage moved to DISQUALIFIED mid-sequence | Queued sends deleted, enrollment STOPPED(disqualified). |
| Priority set to DISQUALIFIED | Stage forced to DISQUALIFIED, sends cancelled, reason required. |
| Reply mid-sequence | Queued sends deleted, STOPPED(replied), stage → REPLIED unless later-stage. |
| Unsubscribe | Suppression + contactability UNSUBSCRIBED + stop; stage untouched. |
| Out-of-office | No stop; +2 business days, max 2 pushes → STOPPED(ooo_loop). |
| Hard bounce | Contactability BOUNCED + suppression + stop; stage untouched; 7-day bounce >3% banner. |
| Send fails 3× | FAILED + STOPPED(send_failed); timeline entry. |
| Business type archived while in use | Blocked; offers bulk reassignment to another type. |
| Industry changed to one the type doesn't belong to | Type cleared and must be re-picked (inline warning). |
| Opportunity UNKNOWN on a RESEARCHED prospect | Blocked by gate; server rejects the transition. |
| `Won`/`Lost` without a reason | `LOST` requires `closed_reason`; `WON` optional. |
| Next action missing past CONTACTED | Allowed to save, but flagged red in list and counted in "Follow-ups due" as `missing next action`. |
| Prospect deleted while enrolled | Soft delete + stop enrollment + tombstone; messages retained. |
| Merge conflict | Field-level winners chosen by the user; enrollments/messages/replies re-pointed; loser soft-deleted; event on both records. |
| Cron gap >8h | Sends rescheduled to the next window; never burst past caps. |
| Concurrent enrollment | Partial unique wins; reported as skipped, no 500. |
| Replied then ghosted | Manual `REPLIED → CONTACTED` (audit-logged) re-opens enrollment in any sequence. |
| Re-run a completed sequence | Impossible by design (`unique(sequence_id, prospect_id)`); duplicate the sequence to re-run the flow. |
| New sending domain | Per-user daily cap ramps: min(daily_send_cap, 5 × days since domain verification); full volume from day 10. |
| Apify 429/402 | Backoff then FAILED(quota) + Settings CTA. |
| Run >45 min | Abort + FAILED(timeout). |
| IMAP auth failure | Banner; sending continues. |
| Unknown reply sender | Inbox item with link/create/ignore. |
| CSV enum value unrecognized | Row error with the offending value + nearest suggestion; never silently coerced. |
| CSV >20k rows | Rejected with split guidance. |
| CSV import exceeds the request limit | Executed as an `IMPORT_BATCH` job with progress polling; the user can leave the page. |
| Duplicate tag labels | Case-insensitive slug match merges into the existing tag; no duplicates created. |
| Apify test run exceeds function duration | `maxDuration = 120` on the route (Vercel Pro); on Hobby the wizard starts an async preview run and polls it. |
| Expired session | 401 → login with `next`; composer state kept in sessionStorage. |
| Mobile | Card lists, sticky bulk bar, bottom tabs, drawer → full page. |
| Empty workspace | Tailored empty state with one next action. |

## 15. Performance

TTFB <400ms on list pages; LCP <2.0s desktop / <3.0s mobile 4G; server pagination everywhere (≤200 rows/query); route-level code splitting; <250KB gzip first-load JS (dynamic-import schema form, charts, editors); TanStack Query `staleTime 30s`; runs poll 10s only while active; imports in 1000-item pages / 500-row transactions; taxonomy cached in memory per request (17 + ~50 rows); DNS cache; `no-store` on authenticated responses. Database connections go through the Supabase transaction pooler with `max: 1` per function instance and `prepare: false` — never open a direct connection at runtime. Queries are single-round-trip where possible; no N+1 in list endpoints (one query for the page, one for tags, one for counts).

**Long operations never run in a request:** CSV import, dataset import, and exports are jobs with progress state (`{processed, total}`) polled every 2s; their HTTP handlers return in <500ms with an id. Only previews and single-record mutations are synchronous.

## 16. Testing Strategy

- **Unit (Vitest):** email normalization/validation, role-address filter, merge-field rendering + fallbacks, business-day math, window/jitter scheduling, warmup ramp math, all 13 qualification operators (incl. list-field intersects and ALL/ANY with nulls), every gate (research, qualification, enrollment) with boundary cases, status transition matrix (allowed/blocked pairs), company-size derivation from counts and ranges, country normalization, CSV mapping + enum coercion, HMAC tokens, Apify mapping, duplicate-candidate detection.
- **Integration (Postgres):** import dedupe/merge idempotency, CSV batch retry, enroll race, every send guard, job claiming with SKIP LOCKED, reply→stop→stage, unsubscribe→suppress (stage unchanged), bounce (stage unchanged), stage→disqualified cancels sends, business-type archive guard, merge integrity.
- **API contract:** happy path + 400/401/403/404 (cross-workspace) + 422 gate violations.
- **Component:** GateChecklist pass/fail rendering, dependent industry→type select, chips multi-select, stage transition menu (only legal options), import mapping table, empty/loading/error states.
- **E2E (Playwright, providers mocked):** (1) setup → source → test run → import → prospects appear with derived size and mapped industry; (2) CSV import with 3 invalid rows → report counts correct; (3) research → gate checklist → qualify → enroll → send → open → reply → enrollment stopped and stage REPLIED; (4) MEMBER blocked from Settings, taxonomy writes, and delete.
- **A11y:** axe on all pages; keyboard smoke tests for drawer, chips, wizard.
- **Responsive:** 375/768/1280 for prospects, drawer, builder, inbox.
- **DoD:** ≥80% coverage on `lib/services` and `lib/email`; CI green for lint/typecheck/test/e2e.

## 17. Project Structure

```
outbound-os/
  app/(auth)/login, app/(app)/{dashboard,prospects,sources,runs,sequences,inbox,library,reports,settings,setup}
  app/(app)/prospects/import, app/u/[token]
  app/api/{prospects,taxonomy,tags,sources,runs,apify,qualification-rules,offers,templates,sequences,
           enrollments,inbox,suppressions,settings,integrations,team,audit,dashboard,track,webhooks,cron,auth}/...
  components/{ui,layout,prospects,sources,runs,sequences,email,inbox,common}
  lib/{db,auth,services,taxonomy,jobs,apify,email,security,validation,utils}
  tests/{unit,integration,api,e2e,fixtures}
  scripts/{seed-taxonomy,tick}.ts
  .github/workflows/{ci.yml,migrate.yml}
  .env.example  drizzle.config.ts  next.config.ts  tailwind.config.ts  vitest.config.ts  playwright.config.ts  README.md
```

`lib/services/*` holds all business logic as `(ctx, input)` functions, unit-testable without HTTP. `lib/taxonomy/` holds enums, labels, seed data, gates, and the transition matrix.

## 18. Implementation Plan

| # | Phase | Builds | Depends on | Done when |
|---|---|---|---|---|
| 1 | Init | Next.js 15 + TS strict + Tailwind + shadcn, env schema, app shell, CI | — | `pnpm dev` runs; lint/typecheck/test pass. |
| 2 | Database + taxonomy | Full Drizzle schema, migrations, taxonomy seed (17 industries, ~50 business types), seed workspace/owner | 1 | Fresh DB migrates + seeds; `/api/taxonomy` returns everything. |
| 3 | Auth | Auth.js, allowlist, guards, login/setup | 2 | Non-allowlisted blocked; RBAC unit-tested. |
| 4 | Prospects core | Services + routes: CRUD, filters, drawer detail, notes, events, stage transitions + gates | 3 | Gate and transition-matrix tests green; filters return correct sets. |
| 5 | Jobs & integrations | Queue + cron, encrypted credentials, Apify/Resend/IMAP clients, Settings→Integrations | 4 | Claim concurrency test passes; all three Test buttons work. |
| 6 | Sourcing + CSV | Source wizard, run engine, import pipeline, CSV wizard + report | 5 | Real actor → classified deduped prospects; CSV with bad rows reports correctly. |
| 7 | Library & sequences | Offers, templates, merge fields, builder, preflight, enroll | 6 | 3-step sequence built; eligibility reasons accurate. |
| 8 | Sending | Scheduler, SEND_STEP guards, Resend send, tracking, webhook, unsubscribe, suppression, stage auto-advance | 7 | Window/caps respected; bounce/unsubscribe behave; stages advance. |
| 9 | Inbox | IMAP sync, reply matching, stop + stage, inbox UI, manual reply | 8 | Reply stops sequence and sets REPLIED within one cycle. |
| 10 | Polish | Dashboard, reports, taxonomy settings, team, audit, states, mobile, a11y, RBAC sweep | 9 | axe clean; all screens implemented. |
| 11 | Testing | Coverage, Playwright, CI | 10 | CI fully green. |
| 12 | Production | Supabase project + pooler config, GitHub Actions (CI + migration), Vercel project + cron, env docs, README runbook | 11 | Deployed; migrations run from CI; full flow works end to end. |

## 19. MVP vs V2 vs Future

**MVP:** auth/allowlist · workspace settings · taxonomy tables + settings tab · Apify sources + schema form + mapping + runs + import/dedupe · **CSV import** · dedupe + duplicate-candidate detection + manual merge · rule engine with suggestions · prospect CRUD, filters, drawer, gap-free gate checklist · stage transition matrix + audit · offers, templates, merge fields · sequences + preflight + enrollment · Resend sending with caps/windows/jitter + stage auto-advance · tracking · unsubscribe + suppression · bounce/complaint webhooks · IMAP replies + inbox · dashboard with pipeline strip + follow-ups due · reports · team · audit · job queue.

**V2:** multiple contacts per prospect; kanban pipeline board; AI classification assist (suggest industry/opportunity from website); AI first-line personalization; Gmail/Outlook OAuth thread sync; A/B testing; saved views; calendar view; Slack notifications; outbound webhooks; CSV scheduled re-import; custom fields UI; multi-workspace switcher; per-prospect activity summary AI.

**Future:** dialer/LinkedIn messaging · CRM deal values & forecasting · booking links · warmup automation · inbox rotation across domains · billing · public API · attribution reporting · website audit automation (Lighthouse checks feeding Opportunity automatically).

## 20. Build Readiness Audit

- Every field from the supplied taxonomy is represented, typed, filterable, and rule-evaluable ✔
- Pipeline stage and contactability are independent; no status collision ✔
- Gates and transitions defined in one place (`TAXONOMY.md`) and enforced server-side ✔
- All 8 flows have entry/system/failure/exit ✔
- Screens defined without extras (no kanban in v1) ✔
- Data model complete with constraints and indexes ✔
- APIs map 1:1 to features; none unused ✔
- Errors, edge cases, and integration failures enumerated ✔
- Architecture consistent: one app, one DB, one queue, three providers ✔
- Contradictions resolved: `Disqualified` is both a priority and a stage → priority forces stage; `Unknown` opportunity only at NEW; `Bounced`/`Unsubscribed` are contactability, not stage ✔
- Long-running work (CSV/dataset import, export) is queued, never inside a request; tags exist as a real entity ✔
- Scope creep prevented: no CRM, no AI, no multi-contact, no board ✔
- Fully specified for incremental execution: `ONE-SHOT-BUILD-PROMPT.md` + `TAXONOMY.md` cover every rule; build proceeds phase-by-phase per §18 with each phase's tests green before the next ✔

---

# D. IMPLEMENTATION CHECKLIST

**Foundation**
- [ ] Init Next.js 15 + TS strict + Tailwind + shadcn; env validation; CI
- [ ] Design tokens + app shell (sidebar/topbar/mobile nav)
- [ ] Drizzle schema incl. taxonomy tables + partial unique indexes
- [ ] Seed taxonomy (17 industries, ~50 business types) + demo workspace/owner
- [ ] Auth.js, allowlist, guards, login/setup

**Prospect core**
- [ ] `lib/taxonomy` enums, labels, gates, transition matrix
- [ ] Prospect service: create, patch, filters, pagination, export
- [ ] Stage transition endpoint with matrix + gate validation + audit
- [ ] Effective gate computation (research / qualification / enrollment) + UI checklist
- [ ] Duplicate-candidate detection + merge
- [ ] Tags: `tags` + `prospect_tags`, inline creation, bulk tag, filter
- [ ] Taxonomy endpoints + Settings → Taxonomy tab

**Sourcing**
- [ ] Apify client (search, schema, start, status, dataset)
- [ ] Source wizard: actor → schema form → mapping → classification preset → schedule
- [ ] Test-run + sample preview (`maxDuration 120`, async fallback)
- [ ] Run engine: start → poll → import (normalize, validate, derive size, dedupe)
- [ ] CSV import: preview (≤200 rows) → `IMPORT_BATCH` job → progress polling → report + error CSV
- [ ] Export as a queued job with download link
- [ ] Runs monitor + detail + cancel/retry/reimport

**Outbound**
- [ ] Offers (+ service links), templates, merge fields, preview
- [ ] Sequence builder + activate/pause
- [ ] Preflight reasons + enroll
- [ ] Scheduler + SEND_STEP guards + stage auto-advance
- [ ] Resend send, Message-ID, pixel/click, unsubscribe
- [ ] Resend webhook → suppression + contactability + stop
- [ ] IMAP sync → reply match → stop + REPLIED → inbox
- [ ] Inbox: reply, assign, outcome, next action, link/create prospect

**Surfaces**
- [ ] Dashboard (stats, pipeline strip, follow-ups due, runs, replies)
- [ ] Prospects table + filter set + bulk bar + drawer (5 tabs) + mobile cards
- [ ] Reports: pipeline, deliverability, source yield
- [ ] Settings: workspace, integrations, taxonomy, team, suppression, audit
- [ ] All empty/loading/error states, confirmations, toasts
- [ ] Accessibility pass

**Quality**
- [ ] Unit: gates, transitions, qualification operators, size derivation, merge fields, dates
- [ ] Integration: import dedupe, CSV batch, enroll race, send guards, reply/bounce/unsub semantics, merge
- [ ] API contract tests incl. cross-workspace 404 and 422 gate violations
- [ ] Playwright E2E (sourcing, CSV, research→send→reply, RBAC)
- [ ] Responsive checks 375/768/1280
- [ ] Deploy: GitHub repo + Actions (CI, migrate on main), Supabase project + pooler/direct URLs, Vercel project + cron, env docs + runbook
- [ ] Verify acceptance criteria in `ONE-SHOT-BUILD-PROMPT.md`
