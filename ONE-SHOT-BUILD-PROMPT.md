# ONE-SHOT BUILD PROMPT — Outbound OS

> Paste this entire file into a fresh chat with your coding agent. It is self-contained.
> `TAXONOMY.md` in the same folder is a longer reference for the enums and gates — everything essential is repeated below.
> Build **phase-by-phase** per `BUILD-PLAN.md` §18 — each phase's tests green before the next phase starts.

---

You are building **Outbound OS**, an internal cold-outbound and prospecting platform for a small agency (3–10 users, single workspace). Build the complete production-ready application in one continuous session. Make decisions yourself where unspecified — do not stop to ask questions. Where a choice is genuinely open, take the simplest robust option described here.

## 1. Objective

A web app built on a **structured prospect record** that:

(a) classifies every business using a fixed taxonomy — Industry, Business Type, Company Size, Geography, Opportunity, Potential Service, Fit, Priority, Contact — plus an 11-stage pipeline;
(b) runs Apify actor scrapers from saved lead-source presets and imports CSVs through the same normalization/dedupe pipeline;
(c) enforces research and qualification **gates** so unresearched prospects cannot enter outreach;
(d) scores prospects with deterministic rules over the taxonomy;
(e) builds offers/templates into multi-step cold email sequences and sends them through a verified domain within strict caps and windows;
(f) tracks opens/clicks, detects replies via IMAP, auto-stops sequences and auto-advances pipeline stages, and presents replies in one inbox with full per-prospect history.

## 2. Stack (fixed)

- Next.js 15 App Router, TypeScript strict, React 19
- Tailwind CSS v4 + shadcn/ui + Radix + Lucide + sonner
- PostgreSQL 16 on **Supabase** + Drizzle ORM + drizzle-kit
- Auth.js v5: Google OAuth + email magic link (Resend), JWT sessions, allowlist only, no self-signup
- Zod everywhere; React Hook Form on the client; TanStack Query for client fetches
- Vitest + Testing Library + Playwright
- Deploy: GitHub repo → Vercel (auto-deploy + PR previews) + Supabase Postgres. Node 20+, pnpm. Migrations run in GitHub Actions on `main`, never in the Vercel build.

No Redis, no worker service, no object storage, no Docker requirement, no AI, no CRM deal pipeline, no kanban board. Supabase Auth, Storage, Realtime and the Data API (PostgREST) are **not used**.

## 3. Design system

shadcn/ui, zinc surfaces, accent violet-600, light+dark (system default, toggle in the user menu). Geist Sans / Geist Mono. 4px spacing scale; radius 8 controls / 12 cards; shadow-sm cards only; buttons 32/36/40, inputs 36. Breakpoints 640/768/1024/1280/1536. Desktop 248px sidebar + 56px topbar; tablet 64px icon rail; mobile hamburger + bottom tabs (Dashboard, Prospects, Inbox, More).

Badges — stage: NEW slate · RESEARCHED blue · QUALIFIED indigo · CONTACTED cyan · FOLLOW_UP amber · REPLIED violet · MEETING teal · PROPOSAL purple · WON emerald · LOST zinc strikethrough · DISQUALIFIED red outline. Fit: strong emerald · good teal · possible amber · poor red · unknown zinc. Priority: high red · medium amber · low zinc · disqualified red outline. Contactability: OK emerald · bounced red · unsubscribed amber · do-not-contact red.

Every list screen needs skeleton loading, a filter-aware empty state with one next action, and an inline retry error panel. WCAG 2.1 AA: visible focus rings, labels on all inputs, `aria-label` on icon buttons, `aria-live` for toasts and run status, focus-trapped modals/drawers, ≥4.5:1 contrast, keyboard-operable chips and selects.

## 4. Roles

OWNER (one, transferable) · ADMIN · MEMBER.

- OWNER only: invite/remove/change roles, hard-delete prospects, delete workspace data.
- ADMIN+: workspace settings, integrations, taxonomy (business types), suppression writes, gate overrides, merges, sequence activate/pause, audit log.
- MEMBER: sources, scrapes, imports, classification, prospect edits, notes, drafts, enrollment, sending, inbox items (own + unassigned).

Every DB query is scoped by `workspace_id` from the session — never from request input.

## 5. Taxonomy (fixed enums + seed data)

**Industry** (17, fixed, rename-only): PROFESSIONAL_SERVICES, HEALTHCARE, HOME_SERVICES, CONSTRUCTION_TRADES, PROPERTY_REAL_ESTATE, HOSPITALITY_FOOD, BEAUTY_WELLNESS, RETAIL_ECOMMERCE, AUTOMOTIVE, EDUCATION_TRAINING, TECHNOLOGY, FINANCE_INSURANCE, CREATIVE_MEDIA, TRAVEL_TOURISM, AGRICULTURE, MANUFACTURING, OTHER.
Labels: Professional Services, Healthcare, Home Services, Construction & Trades, Property & Real Estate, Hospitality & Food, Beauty & Wellness, Retail & E-commerce, Automotive, Education & Training, Technology, Finance & Insurance, Creative & Media, Travel & Tourism, Agriculture, Manufacturing, Other.

**Business Type** (user-extensible table, belongs to exactly one industry). Seed:
- Professional Services: Law Firm, Accounting Firm, Consultancy, Recruitment Agency
- Healthcare: Dentist, Physiotherapy Clinic, Medical Clinic, Optician, Private Practice
- Home Services: Plumbing Company, Electrical Contractor, Cleaning Company, Landscaper, Pest Control
- Construction & Trades: Building Contractor, Roofer, Renovation Company, Groundworks
- Property & Real Estate: Estate Agency, Property Manager, Property Developer
- Hospitality & Food: Restaurant, Café, Hotel, Catering Company
- Beauty & Wellness: Hair Salon, Barber Shop, Spa, Gym, Wellness Centre
- Retail & E-commerce: Retail Store, Boutique, Online Shop
- Automotive: Auto Repair Shop, Car Dealership, Detailing Studio, Car Rental
- Education & Training: Training Company, Tutoring Service, Academy, School
- Technology: SaaS Company, IT Services, Software Company
- Finance & Insurance: Financial Adviser, Insurance Broker, Insurance Company
- Creative & Media: Marketing Agency, Design Studio, Photography Studio, Production Company
- Travel & Tourism: Tour Operator, Travel Agency, Accommodation Provider
- Agriculture: Farm, Agricultural Services, Agricultural Supplier, Food Processor
- Manufacturing: Manufacturer, Fabricator, Industrial Supplier
- Other: Other

A type's industry is immutable. Archiving a type in use is blocked (offer bulk reassignment to another type).

**Company Size**: SOLO (1) · MICRO (2–5) · SMALL (6–20) · SMALL_MEDIUM (21–50) · MEDIUM (51–200) · LARGE (201+) · UNKNOWN.
Derive from a numeric count accordingly; from a range string use the upper bound; never overwrite a manually set size.

**Geography**: `city`, `region`, `country_code` (ISO-3166-1 alpha-2 or null), `market` (free text, e.g. UK / DACH / Benelux).

**Opportunity** (14, multi-select): NO_WEBSITE, OUTDATED_WEBSITE, POOR_MOBILE_EXPERIENCE, POOR_USER_EXPERIENCE, WEAK_BRANDING, WEAK_CONVERSION, NO_LEAD_CAPTURE, NO_ONLINE_BOOKING, ECOMMERCE_OPPORTUNITY, NEEDS_AUTOMATION, NEEDS_WEB_APPLICATION, WEBSITE_PERFORMANCE, SEO_DISCOVERABILITY, UNKNOWN.
`UNKNOWN` is exclusive with all others and only allowed while stage = NEW.

**Potential Service** (15, multi-select): WEBSITE_DESIGN, WEBSITE_REDESIGN, WEBSITE_DEVELOPMENT, LANDING_PAGE, ECOMMERCE, BRAND_IDENTITY, BRAND_REFRESH, UI_UX_DESIGN, WEB_APPLICATION, BOOKING_SYSTEM, LEAD_GENERATION_SYSTEM, BUSINESS_AUTOMATION, WEBSITE_OPTIMISATION, ONGOING_SUPPORT, OTHER.

Suggestion map (button "Suggest services"): NO_WEBSITE→WEBSITE_DESIGN · OUTDATED_WEBSITE→WEBSITE_REDESIGN · POOR_MOBILE_EXPERIENCE→WEBSITE_REDESIGN,WEBSITE_OPTIMISATION · POOR_USER_EXPERIENCE→UI_UX_DESIGN · WEAK_BRANDING→BRAND_IDENTITY,BRAND_REFRESH · WEAK_CONVERSION→LANDING_PAGE,WEBSITE_OPTIMISATION · NO_LEAD_CAPTURE→LEAD_GENERATION_SYSTEM · NO_ONLINE_BOOKING→BOOKING_SYSTEM · ECOMMERCE_OPPORTUNITY→ECOMMERCE · NEEDS_AUTOMATION→BUSINESS_AUTOMATION · NEEDS_WEB_APPLICATION→WEB_APPLICATION · WEBSITE_PERFORMANCE→WEBSITE_OPTIMISATION · SEO_DISCOVERABILITY→WEBSITE_OPTIMISATION.

**Fit**: STRONG, GOOD, POSSIBLE, POOR, UNKNOWN.
**Priority**: HIGH, MEDIUM, LOW, DISQUALIFIED. Invariant: DISQUALIFIED priority ⇒ stage DISQUALIFIED, queued sends cancelled, reason required.
**Contact Role**: OWNER, FOUNDER, MANAGING_DIRECTOR, CEO, MARKETING_DIRECTOR, MARKETING_MANAGER, OPERATIONS_DIRECTOR, OPERATIONS_MANAGER, GENERAL_MANAGER, OTHER_DECISION_MAKER.
**Contact Quality**: VERIFIED, UNVERIFIED, RISKY, BOUNCED, UNKNOWN.
**Stage** (11): NEW, RESEARCHED, QUALIFIED, CONTACTED, FOLLOW_UP, REPLIED, MEETING, PROPOSAL, WON, LOST, DISQUALIFIED.
**Contactability** (separate system-managed axis): OK, BOUNCED, UNSUBSCRIBED, DO_NOT_CONTACT.

**Gates (enforced server-side):**
- *Research* (→ RESEARCHED): industry set · business_type set · company_size ≠ UNKNOWN · ≥1 opportunity that is not UNKNOWN · fit ≠ UNKNOWN · country_code set · contact_name set · contact_role set.
- *Qualification* (→ QUALIFIED): research gate + fit ∈ {STRONG, GOOD} + ≥1 service + priority ∈ {HIGH, MEDIUM} + contact email present + contact_quality ≠ BOUNCED + contactability = OK + not suppressed.
- *Enrollment*: stage ∈ {QUALIFIED, CONTACTED, FOLLOW_UP} + priority ∉ {LOW, DISQUALIFIED} + fit ∉ {POOR, UNKNOWN} + email present + contactability OK + not suppressed + no other active enrollment.

**Overrides:** only the *qualification* gate is overridable (ADMIN+, reason ≥10 chars, audit-logged → `gate_override_reason`). The research gate is data completeness and cannot be overridden.

**Transitions** (reject anything else with 422): NEW→{RESEARCHED, DISQUALIFIED} · RESEARCHED→{QUALIFIED, NEW, LOST, DISQUALIFIED} · QUALIFIED→{CONTACTED, NEW, RESEARCHED, MEETING, LOST, DISQUALIFIED} · CONTACTED→{FOLLOW_UP, REPLIED, MEETING, PROPOSAL, LOST, DISQUALIFIED} · FOLLOW_UP→{REPLIED, MEETING, PROPOSAL, LOST, DISQUALIFIED} · REPLIED→{CONTACTED, MEETING, PROPOSAL, LOST, DISQUALIFIED} · MEETING→{PROPOSAL, WON, LOST, DISQUALIFIED} · PROPOSAL→{WON, LOST, DISQUALIFIED} · WON/LOST/DISQUALIFIED terminal (reopen: LOST→RESEARCHED, DISQUALIFIED→NEW, audit-logged). LOST and DISQUALIFIED require `closed_reason` (≥3 chars). All transitions audit-logged with from/to/actor/reason.

**System-driven transitions:** first successful send → stage CONTACTED if stage ∈ {NEW, RESEARCHED, QUALIFIED, CONTACTED}; step ≥2 sent while CONTACTED → FOLLOW_UP; matched reply → REPLIED unless stage ∈ {MEETING, PROPOSAL, WON, LOST}; bounce/unsubscribe change **contactability only**, never stage; reply sets contact_quality VERIFIED.

## 6. Data model

Drizzle, uuid PKs, timestamptz, `workspace_id` FK cascade on all business tables.

```
workspaces(name, timezone 'Europe/Zurich', send_window_start/end 09:00/17:00,
  daily_send_cap 50, -- per-user daily cap (applied to each sender)
  hourly_send_cap 60, track_opens, track_clicks, unsubscribe_footer, setup_completed_at)
users(email text unique check (email = lower(email)), name, role, status, avatar_url, session_version)
accounts, sessions, verification_tokens                      -- Auth.js
industries(slug pk, label)                                   -- 17 seeded, rename-only
business_types(id, industry_slug fk, label, slug, is_system, archived_at)
  unique(industry_slug, slug)                       -- slug derived from label; avoids an expression index
integration_credentials(kind APIFY|RESEND|IMAP, label, config jsonb,
  secret_ciphertext, secret_iv, secret_tag, verified_at, last_error)   unique(workspace_id, kind)

lead_sources(name, description, actor_id, actor_name, input_defaults jsonb, mapping jsonb,
  default_industry, default_market, default_opportunity, qualification_rule_id,
  schedule OFF|DAILY|WEEKLY, schedule_hour, verify_mx, allow_role_addresses, archived_at,
  last_run_at, created_by)
source_runs(source_id, apify_run_id unique, status QUEUED|RUNNING|SUCCEEDED|FAILED|CANCELLED|IMPORTED,
  input jsonb, started_at, finished_at, items_fetched/imported/duplicate/invalid/qualified/disqualified,
  error jsonb, sample_items jsonb)
import_batches(kind CSV, file_name, mapping jsonb, status PREVIEW|RUNNING|DONE|FAILED,
  rows_total, rows_imported, rows_invalid, rows_duplicate, error_report jsonb, created_by)

prospects(
  business_name, website, domain_normalized,
  industry_slug fk, business_type_id fk,
  company_size SOLO|MICRO|SMALL|SMALL_MEDIUM|MEDIUM|LARGE|UNKNOWN, employee_count int,
  city, region, country_code char(2), market,
  fit STRONG|GOOD|POSSIBLE|POOR|UNKNOWN, priority HIGH|MEDIUM|LOW|DISQUALIFIED,
  stage NEW|RESEARCHED|QUALIFIED|CONTACTED|FOLLOW_UP|REPLIED|MEETING|PROPOSAL|WON|LOST|DISQUALIFIED,
  contactability OK|BOUNCED|UNSUBSCRIBED|DO_NOT_CONTACT,
  contact_name, contact_first_name, contact_last_name, contact_role enum(10),
  contact_email, contact_email_normalized text check (contact_email_normalized = lower(contact_email_normalized)),
  contact_phone, contact_linkedin,
  contact_quality VERIFIED|UNVERIFIED|RISKY|BOUNCED|UNKNOWN,
  next_action text, follow_up_date date, closed_reason text, gate_override_reason text,
  qualification_rule_id, qualification_revision,
  source_id, source_run_id, owner_user_id, is_duplicate_candidate bool,
  custom_fields jsonb '{}', last_contacted_at, last_reply_at, deleted_at)
  unique(workspace_id, contact_email_normalized) where contact_email_normalized is not null and deleted_at is null
  index(workspace_id, stage, created_at desc), (workspace_id, industry_slug),
        (workspace_id, follow_up_date), (workspace_id, domain_normalized), gin(custom_fields)

prospect_opportunities(prospect_id, opportunity)  pk(both)
prospect_services(prospect_id, service)           pk(both)
tags(id, workspace_id, label, slug)               unique(workspace_id, slug)
prospect_tags(prospect_id, tag_id)                pk(both), index(tag_id)
prospect_notes(prospect_id, body_md, author_user_id)
prospect_events(prospect_id, type, payload jsonb, actor_user_id, created_at)
deleted_emails(workspace_id fk, email_normalized, deleted_at)   unique(workspace_id, email_normalized)
suppressions(email_normalized text check (email_normalized = lower(email_normalized)),
  reason UNSUBSCRIBED|HARD_BOUNCE|COMPLAINT|MANUAL|INVALID,
  source, note, created_by)   unique(workspace_id, email_normalized)

qualification_rules(name, description, match ALL|ANY, conditions jsonb, revision, is_active, created_by)
offers(name, summary, value_prop_md, price_text, constraints, is_active)
offer_services(offer_id, service)
email_templates(name, subject, body_md, offer_id, category, archived_at)
sequences(name, description, status DRAFT|ACTIVE|PAUSED|ARCHIVED, created_by)
sequence_steps(sequence_id, position, template_id, subject_override, body_override_md,
  delay_business_days default 3)  unique(sequence_id, position)
enrollments(sequence_id, prospect_id, status ACTIVE|PAUSED|COMPLETED|STOPPED|FAILED,
  current_step, next_send_at, stop_reason, ooo_pushes, enrolled_by)
  unique(sequence_id, prospect_id)
  partial unique(workspace_id, prospect_id) where status = 'ACTIVE'
  index(status, next_send_at)
messages(enrollment_id, prospect_id, step_id, to_email, from_email, subject, body_md, html, text,
  provider, provider_message_id, message_id_header,
  status QUEUED|SENT|DELIVERED|BOUNCED|COMPLAINED|FAILED, is_manual,
  open_count, click_count, sent_at, opened_at, clicked_at, error)
replies(prospect_id nullable, message_id, from_email, to_email, subject, body_text, snippet,
  received_at, imap_uid, imap_uidvalidity bigint, imap_folder, is_read, assigned_user_id,
  outcome POSITIVE|NEUTRAL|NEGATIVE|NOT_INTERESTED|OOO)
  unique(workspace_id, imap_folder, imap_uidvalidity, imap_uid)
jobs(type, payload jsonb, status PENDING|CLAIMED|DONE|DEAD, run_at, attempts, max_attempts 5,
  locked_at, locked_by, last_error, dedupe_key unique)
dns_cache(domain pk, has_mx, checked_at)
audit_logs(user_id, action, target_type, target_id, meta jsonb, ip, created_at)
```

Indexes on every `workspace_id` + filter/sort combination, plus `enrollments(status,next_send_at)`, `jobs(status,run_at)`, `messages(prospect_id,sent_at desc)`, `source_runs(workspace_id,status,created_at desc)`.

**Invariants:** one ACTIVE enrollment per prospect · DISQUALIFIED priority forces stage + cancels sends · UNKNOWN opportunity only at NEW · LOST/DISQUALIFIED need `closed_reason` · business type must belong to the prospect's industry · suppression + contactability checked at send time · no send within 24h per prospect · contiguous step positions · hard delete → tombstone · messages/replies/events/audit append-only.

## 7. Features and required behavior

**7.1 Integrations.** Settings → Integrations: three cards (Apify, Resend, IMAP) with masked values, Test, Replace, Delete. Apify test = `GET https://api.apify.com/v2/users/me`. Resend test = `GET https://api.resend.com/domains` and confirm the configured domain is present and verified. IMAP test = connect + open INBOX + logout. Secrets AES-256-GCM encrypted with `APP_ENCRYPTION_KEY`, never returned (mask `••••` + last 4), never logged. Non-secret config (IMAP host/port/user, Resend domain/from-name/reply-to) lives in `config` jsonb.

**7.2 Taxonomy management.** Settings → Taxonomy lists industries (rename-only), business types grouped by industry with usage counts (create, rename, archive with reassignment), and read-only chip lists for opportunities, services, roles, sizes, fits, priorities, stages. `GET /api/taxonomy` returns everything with labels for pickers.

**7.3 Lead sources.** 5-step wizard: Identity (name, description, actor via `GET /v2/store?search=` or pasted ID) → Input (`GET /v2/acts/{id}` `inputSchema` rendered as a form; string/number/boolean/enum/array-of-string/object supported; unsupported → validated raw JSON) → Mapping (detected output fields → taxonomy targets: business_name, website, email, first_name, last_name, contact_name, role, phone, linkedin, city, region, country, industry, business_type, employee_count, category, notes; heuristic auto-guess; unmapped → `custom_fields`) → Classification preset (default industry / market / opportunity + qualification rule) → Review + schedule. "Test with 1 item" on steps 2–4 returns ≤5 sample items (90s cap).

**7.4 Run engine.** APIFY_START → `POST /v2/acts/{actorId}/runs`, store `apify_run_id`, RUNNING, enqueue APIFY_POLL +20s. APIFY_POLL → `GET /v2/actor-runs/{runId}`; re-enqueue while RUNNING; FAILED → store error; SUCCEEDED → APIFY_IMPORT. Abort runs >45 min. APIFY_IMPORT → `GET /v2/datasets/{datasetId}/items?limit=1000&offset=…`, normalize → validate → dedupe → derive size/country → apply preset → insert in 500-row transactions, update counters, status IMPORTED. Idempotent per `source_run_id`.

**7.5 CSV import.** 4 steps: upload/paste (≤10MB, ≤20k rows, header required) → column mapping (enum columns accept slug or label, case-insensitive, with nearest-suggestion on miss; unmapped → custom field or ignore) → dry-run preview (first 200 rows only, synchronous: counts valid / invalid / duplicate / duplicate-candidate / suppressed) → **async import**: `POST /api/prospects/import` stores the mapping, creates an `import_batches` row and enqueues an `IMPORT_BATCH` job in 500-row chunks; the handler returns a `batchId` in under 500ms. The UI polls `GET /api/prospects/import/[batchId]` every 2s for `{processed, total, imported, invalid, duplicate}` and shows a progress bar; the user may leave the page and receives a completion notification. Report screen shows counts + a downloadable error CSV; re-runnable from the stored mapping. Defaults when unmapped: stage NEW, priority MEDIUM, fit UNKNOWN, opportunity UNKNOWN, contact_quality UNKNOWN.

**7.5b Tags.** Workspace-scoped free-text labels: `tags` + `prospect_tags`. Created inline on first use (case-insensitive slug dedupe), assignable from the drawer and the bulk bar, filterable in the list, renameable and deletable (ADMIN+). `GET /api/tags` returns tags with prospect counts for the filter and autocomplete.

**7.6 Normalization.** Trim + lowercase email; RFC-5322-lite regex; role-prefix rejection (info, sales, support, admin, hello, contact, office, noreply, billing, jobs) unless allowed; optional MX check cached 24h; website → https URL + `domain_normalized`; derive `company_size` from employee count/range when unset; country name/code → ISO alpha-2 via a static map; strip UTM params; truncate (business_name 200, email 320, name 120, city/region 120, market 60, notes 20k). contact_first_name/contact_last_name are authoritative; contact_name is derived as "first last" and recomputed on save. Invalid rows go only to the run/import report.

**7.7 Dedupe/merge.** Hard unique on email (partial index). Same domain + different email → `is_duplicate_candidate` flag + banner, never blocked. On conflict fill only empty fields, append provenance, keep stage/history. Tombstoned email → skipped `previously_deleted`. Manual merge (ADMIN): choose primary, pick field-level winners, re-point enrollments/messages/replies/notes, soft-delete the loser, event on both.

**7.8 Qualification rules.** Rule = `match` ALL/ANY over `{field, operator, value, weight}`. Fields: business_name, industry, business_type, company_size, city, region, country_code, market, opportunity (list), service (list), fit, priority, contact_role, contact_quality, website, domain, source, `custom.<key>`. Operators: equals, not_equals, contains, not_contains, starts_with, ends_with, is_empty, is_not_empty, gt, lt, in_list, not_in_list, regex (ci, 200ms guard). List fields use intersects / not-intersects. Missing → comparisons fail; `is_empty` passes. Score = normalized weighted sum 0–100 (negative weights allowed). A rule recommends fit/priority (never writes them automatically); the recommendation shows in the drawer. Rules versioned; prospects store the revision. Tester endpoint evaluates raw rows or existing prospects with per-condition output.

**7.9 Prospects list.** Server pagination 25/50/100; URL-synced filters: search (business name / domain / contact name / email), stage multi, industry, business type (dependent), company size, country/region/city/market, opportunity multi, service multi, fit, priority, contact quality, contactability, has email, gate status (ready / incomplete), owner, tag, follow-up due (overdue/today/week). Columns: business + domain, industry/type, location, size, stage, fit, priority, contact, next action + due date (overdue in red), last contact. Bulk: enroll, stage change, priority, fit, tag, owner, suppress, export CSV (enqueues an export job, ≤50k, returns a download link), delete (OWNER). Cap 5,000 per bulk action. Bulk stage change routes through the same transition service as the single-record endpoint (matrix, gates, closed_reason, audit); per-row failures are reported in the result, never a 500. Mobile → cards + filter sheet + sticky bulk bar.

**7.10 Prospect drawer (560px, full page on mobile), 5 tabs.**

- *Overview*: identity, geography, stage + transition menu, fit/priority, contactability badges, next action + follow-up date, owner, tags, source provenance with run link, gate summary, "Suggest services", duplicate-candidate banner + Merge.
- *Research*: full classification form (industry → dependent business type, size, geography, opportunity chips, service chips + suggestions, fit, priority, contact fields with role + quality), **live GateChecklist** (each requirement ✓/✕, remaining count), Save / "Mark researched" / "Qualify" (disabled until the gate passes), ADMIN-only "Qualify anyway" with reason ≥10 chars.
- *Timeline*: imported, classified, gate passed/overridden, enrolled, sent, opened, clicked, replied, bounced, unsubscribed, stage change (from/to/actor/reason), notes, merges.
- *Emails*: every message with subject, status, timestamps, rendered body.
- *Notes*: append-only markdown with author + timestamp.

**7.11 Offers / templates.** Offers: name, summary, value prop markdown, price text, constraints, linked services, active; deletion blocked while referenced. Templates: subject ≤150, body markdown ≤8000, optional offer, category. Merge fields: `{{business_name}} {{first_name}} {{last_name}} {{contact_name}} {{role}} {{city}} {{region}} {{country}} {{industry}} {{business_type}} {{company_size}} {{market}} {{website}} {{custom.<key>}}`; fallbacks first_name/contact_name → "there", others → "". Preview for a chosen prospect in a sandboxed iframe; spam-word warning non-blocking.

**7.12 Sequences.** CRUD + builder (ordered steps, ↑↓ reorder, delay 0–30 business days, template or inline override). DRAFT/ACTIVE/PAUSED/ARCHIVED. Activate requires ADMIN+, ≥1 step, all steps renderable, verified domain, no archived template references. Pause cancels queued sends. Archive requires no active enrollments. A prospect can never re-enter the same sequence (`unique(sequence_id, prospect_id)` is permanent) — to re-run a flow, duplicate the sequence. Stats: enrolled/sent/opened/clicked/replied/bounced/completed/stopped.

**7.13 Enrollment.** Preflight returns eligible + counts per exclusion reason (wrong stage, low priority, poor fit, suppressed, bounced, unsubscribed, no email, in another active sequence, gate incomplete, do-not-contact). Enroll sets `current_step = 0`, `next_send_at` = next window start, enqueues SEND_STEP. Concurrent duplicate enroll → partial unique wins, reported as skipped, never a 500.

**7.14 Sending.** SEND_STEP re-validates at execution: sequence ACTIVE, enrollment ACTIVE, prospect not suppressed/bounced/unsubscribed/do-not-contact, stage ∉ {WON, LOST, DISQUALIFIED}, no email in the last 24h, under the effective daily cap — min(daily_send_cap, 5 × days since the sending-domain credential was verified; full volume from day 10) — and 60/hour/workspace, inside Mon–Fri 09:00–17:00 workspace TZ (else reschedule to the next window). Render → text + minimal HTML → unsubscribe footer + tracking pixel + click rewriting → Resend `POST /emails` with `from`, `reply_to`, `List-Unsubscribe`(+`-Post`) headers and a generated `Message-ID`. On success: SENT, stage auto-advance (rule above), advance step, `next_send_at` = +delay business days at window start + 0–90 min jitter; exhausted → COMPLETED. Failures: 429 → +5 min; invalid address → permanent FAILED + contactability BOUNCED; 5xx → retry 1m/5m/15m then FAILED + STOPPED(send_failed).

**7.15 Tracking / unsubscribe.** HMAC-signed `messageId:type` tokens. Open pixel sets `opened_at`/`open_count`; click route validates http(s) and not the app host, then 302s. `/u/{token}` works logged out: confirm → suppression + contactability UNSUBSCRIBED + stop all active enrollments; **stage unchanged**.

**7.16 Webhooks.** Resend with Svix signature verification: delivered → DELIVERED; hard bounce → BOUNCED + suppression(HARD_BOUNCE) + contactability BOUNCED + stop (stage unchanged); complaint → COMPLAINED + suppression(COMPLAINT) + contactability DO_NOT_CONTACT + stop. Idempotent per provider event id.

**7.17 Replies.** Cron every 5 min: fetch after the last UID (≤200/cycle; store UIDVALIDITY and re-key when it changes), decode UTF-8 with latin-1 fallback, match by `In-Reply-To`/`References` → `messages.message_id_header`, else by sender. Match → create reply, stop enrollment(replied), delete queued sends, stage → REPLIED (guarded), contact_quality → VERIFIED, notify assignee. OOO → no stop, +2 business days, max 2 pushes then STOPPED(ooo_loop). Unsubscribe intent → suppression + stop. Unmatched → reply with null prospect ("unknown sender"). IMAP failure → integration banner, sending continues.

**7.18 Inbox.** Two panes; filters unread/mine/unassigned/outcome/date; actions reply (Resend, `In-Reply-To` set, logged as manual message, cap-respecting), read/unread, assign, outcome, set next action + follow-up date, advance stage, suppress, link/create prospect, ignore.

**7.19 Suppression.** List with reason/source/date/actor; add single or CSV paste; export; delete (ADMIN+); consulted at send time and at enrollment.

**7.20 Settings.** Workspace (name, TZ, window, caps, tracking toggles, footer) · Integrations · Taxonomy · Team (invite → allowlist + magic link, role change, remove with OWNER protection) · Suppression · Audit (paginated, filter by user/action/date). Audit-logged: sign-in/out, role changes, credential changes, taxonomy changes, gate overrides, stage changes, merges, suppression changes, hard deletes, sequence activate/pause, bulk actions, exports.

**7.21 Jobs.** `POST /api/cron/tick` (60s, `x-cron-secret`) claims atomically with `FOR UPDATE SKIP LOCKED` (≤20/cycle), retries `2^attempts` minutes, DEAD after 5 (shown on the dashboard health widget). Types: APIFY_START, APIFY_POLL, APIFY_IMPORT, SEND_STEP, IMAP_SYNC, SCHEDULE_SOURCE, IMPORT_BATCH. Idempotent via `dedupe_key`.

**7.22 Dashboard / reports / notifications.** Dashboard: 4 stat cards (prospects total + new this week, research queue, emails sent 7d + reply rate, follow-ups due) → pipeline strip of 11 stage counts (clickable) → 30-day sent/replies chart → last 5 runs + last 5 replies → onboarding checklist when empty. Reports: pipeline (stage/fit/priority distribution, win rate), deliverability (bounce/open/reply/click, 30 days), source yield (prospects by source → qualified → replied). Notifications: reply assigned, run failed, follow-up due, sequence completed, cap reached, duplicate candidate.

## 8. API

REST under `app/api`. Session auth on everything except `/api/health`, `/api/auth/*`, `/api/track/*`, `/u/*`, `/api/webhooks/resend`, `/api/cron/tick`. Error envelope `{ error: { code, message, details? } }`; 400 validation, 401, 403, 404 (incl. cross-workspace), 409, 422 business rule (gates, transitions, invariants), 429, 500. Zod-validate every body; reject unknown keys on PATCH.

```
GET  /api/dashboard
GET  /api/prospects                      POST /api/prospects
GET  /api/prospects/[id]                 PATCH /api/prospects/[id]        DELETE (OWNER)
POST /api/prospects/[id]/stage           { to, reason? }
POST /api/prospects/[id]/qualify         { target: RESEARCHED|QUALIFIED, override?, reason? }
POST /api/prospects/[id]/notes
POST /api/prospects/[id]/merge           { duplicateId, fieldWinners }
POST /api/prospects/bulk                 { action, ids[], value? }
POST /api/prospects/export               GET  /api/prospects/export/[jobId]
POST /api/prospects/import/preview       POST /api/prospects/import
GET  /api/prospects/import/[batchId]     GET  /api/tags
GET  /api/taxonomy                       POST /api/taxonomy/business-types
PATCH/DELETE /api/taxonomy/business-types/[id]
GET/POST /api/sources                    GET/PATCH/DELETE /api/sources/[id]
POST /api/sources/[id]/run               POST /api/sources/test-run
GET  /api/apify/actors                   GET  /api/apify/actors/[actorId]/schema
GET  /api/runs                           GET  /api/runs/[id]
POST /api/runs/[id]/cancel | retry | reimport
GET/POST /api/qualification-rules        GET/PATCH/DELETE /api/qualification-rules/[id]
POST /api/qualification-rules/test
GET/POST /api/offers                     GET/PATCH/DELETE /api/offers/[id]
GET/POST /api/templates                  GET/PATCH/DELETE /api/templates/[id]
POST /api/templates/[id]/preview
GET/POST /api/sequences                  GET/PATCH/DELETE /api/sequences/[id]
PUT  /api/sequences/[id]/steps           POST /api/sequences/[id]/activate|pause|preflight|enroll
GET  /api/enrollments                    POST /api/enrollments/[id]/stop
GET  /api/inbox                          GET/PATCH /api/inbox/[id]        POST /api/inbox/[id]/reply
GET/POST /api/suppressions               DELETE /api/suppressions/[id]
GET/PATCH /api/settings                  GET /api/integrations
PUT/POST-test/DELETE /api/integrations/[kind]
GET  /api/team                           POST /api/team/invite            PATCH/DELETE /api/team/[id]
GET  /api/audit
GET  /api/track/o/[token].gif            GET /api/track/c/[token]         GET/POST /u/[token]
POST /api/webhooks/resend                POST /api/cron/tick
```

## 9. Security

Session cookies httpOnly/secure/sameSite=lax, 30-day JWT; magic links hashed, single-use, 15-min TTL; allowlist enforced at sign-in with a generic error; `session_version` bump invalidates sessions on removal/role change. Same-origin `Origin` check on mutations. Drizzle parameterized queries only. Markdown → HTML with an element allowlist (`p,br,strong,em,ul,ol,li,a,h3,h4,blockquote`); previews only in sandboxed iframes; CSP `default-src 'self'` + nonce, `img-src 'self' data: https:`. Secrets AES-256-GCM, `server-only` modules, never in responses or logs. Rate limits: 60 mutations/min/user, 10 concurrent + 100/day Apify runs/workspace; cron secret required. CSV ≤10MB / 20k rows; JSONB ≤1MB. Supabase Data API (PostgREST) disabled for the project; if ever enabled, all tables get deny-all RLS and the anon key is never shipped to the client — the service-role key is server-only and distinct from the pooler user. `Cache-Control: no-store` on authenticated responses. Soft-deleted prospects purged after 30 days.

## 10. Edge cases that must be handled

No email on a scraped prospect → record created at NEW, enrollment blocked `no_email`. Missing business name → rejected into the run report. Same domain + different email → duplicate candidate, not blocked. In-dataset duplicates → first wins. Already in an active sequence → skipped. Stage → DISQUALIFIED mid-sequence → queued sends deleted, enrollment stopped. Priority → DISQUALIFIED → stage forced + reason required. Reply mid-sequence → queued sends deleted + REPLIED unless later stage. Unsubscribe → suppress + contactability only. OOO → delay, max 2 pushes. Hard bounce → contactability BOUNCED, stage untouched, 7-day bounce >3% banner. Send fails ×3 → FAILED + stopped. Business type archived while in use → blocked with reassignment. Industry changed so the type no longer matches → type cleared with inline warning. UNKNOWN opportunity on a RESEARCHED prospect → transition rejected. LOST without reason → rejected. Missing next action past CONTACTED → saved but flagged red and counted as "missing next action". Deleted prospect while enrolled → soft delete + stop + tombstone. Merge → field winners, re-pointed relations, events on both. Cron gap → reschedule, never burst past caps. Concurrent enroll → one wins, reported, no 500. Apify 429/402 → backoff then FAILED(quota) + Settings CTA. Run >45 min → aborted. IMAP failure → banner only. Unknown sender → inbox item with link/create/ignore. CSV unknown enum → row error with suggestion, never coerced. CSV >20k rows → rejected with guidance. CSV import exceeding a request's duration → runs as an `IMPORT_BATCH` job with progress polling and the page may be left. Apify 1-item test exceeding function duration → `maxDuration = 120` on the route (Vercel Pro); on Hobby the wizard starts an async preview run and polls it. Duplicate tag labels → merged by slug, never duplicated. Expired session → 401 → login with `next`. Mobile → cards, sticky bulk bar, drawer becomes a page. Empty workspace → tailored empty state. Replied then ghosted → manual REPLIED→CONTACTED (audit-logged) re-opens enrollment. Completed sequence → a prospect can never re-enter it; duplicate the sequence to re-run. New sending domain → per-user daily cap ramps at 5 × days since domain verification (full volume day 10).

## 11. Performance

Server-paginate all lists (≤200 rows/query). TTFB <400ms; LCP <2.0s desktop / <3.0s mobile 4G; first-load JS <250KB gzip (dynamic-import schema form, charts, editors). Runs poll 10s only while active. Imports in 1000-item pages / 500-row transactions. **Long operations never run inside a request:** CSV import, dataset import, and exports are jobs with `{processed,total}` progress polled every 2s; their handlers return in <500ms with an id. Only previews and single-record mutations are synchronous. Taxonomy loaded once per request (17 industries + ~50 types). Runtime DB connections go through the Supabase transaction pooler (`:6543`) with `postgres-js`, `prepare: false`, and `max: 1` per function instance; never open a direct connection at runtime. List endpoints use one query per page plus one for tags and one for counts — no N+1.

## 12. Project structure

```
app/(auth)/login, app/(app)/{dashboard,prospects,sources,runs,sequences,inbox,library,reports,settings,setup}
app/(app)/prospects/import, app/u/[token], app/api/**
components/{ui,layout,prospects,sources,runs,sequences,email,inbox,common}
lib/{db,auth,services,taxonomy,jobs,apify,email,security,validation,utils}
tests/{unit,integration,api,e2e,fixtures}
scripts/{seed-taxonomy,tick}.ts, migrations/, .github/workflows/{ci.yml,migrate.yml}, .env.example, README.md,
drizzle.config.ts, vitest.config.ts, playwright.config.ts
```

`lib/services/*` = business logic as `(ctx, input)` functions, unit-testable without HTTP. `lib/taxonomy/` = enums, labels, seeds, gates, transition matrix. Route handlers are thin: auth → validate → service → error mapping.

## 13. Testing requirements

**Unit:** email normalization/validation, role-address filter, merge fields + fallbacks, business-day math, window/jitter scheduling, all 13 qualification operators (incl. list intersects and ALL/ANY with nulls), research/qualification/enrollment gates at boundaries, transition matrix (every allowed and blocked pair), company-size derivation from counts and ranges, country normalization, CSV mapping + enum coercion, HMAC tokens, Apify item mapping, duplicate-candidate detection.

**Integration (real Postgres):** import dedupe/merge idempotency, CSV batch retry and resume, IMPORT_BATCH progress accounting, exported-job completion, tag slug dedupe, enroll race under the partial unique index, every send guard, job claiming with SKIP LOCKED, reply→stop→stage, unsubscribe (stage unchanged), bounce (stage unchanged), DISQUALIFIED cancels sends, business-type archive guard, merge integrity. CI runs these against a `postgres:16` service container; a nightly job replays the critical subset against a Supabase staging project (pooler + `prepare: false`) to catch connection-mode regressions.

**API contract:** happy path + 400/401/403/404 cross-workspace + 422 gate and transition violations.

**Component:** GateChecklist rendering, dependent industry→type select, chip multi-selects, stage transition menu showing only legal options, import mapping table, empty/loading/error states.

**E2E (Playwright, providers mocked):** (1) setup → source → test run → import → prospects with derived size and mapped industry; (2) CSV import with 3 invalid rows → correct report counts; (3) research → gate checklist → qualify → enroll → send → open → reply → stopped + REPLIED; (4) MEMBER blocked from Settings, taxonomy writes, delete.

axe checks on every page. Responsive checks at 375/768/1280. CI runs `lint`, `typecheck`, `test`, `e2e`. Coverage ≥80% on `lib/services` and `lib/email`.

## 14. Deployment

**Topology:** GitHub repo is the source of truth. Vercel deploys `main` automatically and every PR to a preview URL. Supabase hosts Postgres only. GitHub Actions runs CI and, on `main`, applies migrations; Vercel's deploy hook fires after the migration job succeeds.

**Database connection:** two URLs. `DATABASE_URL` = Supabase transaction pooler, `aws-0-<region>.pooler.supabase.com:6543`, user `postgres.<project-ref>` — used at runtime with `postgres-js`, `{ prepare: false, max: 1 }`. `DIRECT_URL` = `db.<project-ref>.supabase.co:5432` — used only by `drizzle.config.ts` for `drizzle-kit migrate` / `generate` / `studio`. Runtime must never use `DIRECT_URL`.

**Migrations:** expand/contract only (add nullable column → deploy → backfill → enforce). Never run `drizzle-kit migrate` in a Vercel build step. `migrate.yml` triggers on `push: branches: [main]`, waits for `ci.yml` to pass, and runs against the production `DIRECT_URL` from the `production` GitHub Environment. If a migration fails, Vercel must not deploy — trigger Vercel with a deploy hook from the end of the workflow rather than relying on the default Git integration, OR keep the Git integration and accept that a failed migration leaves old code running against a partially-migrated DB (which expand/contract makes safe).

**CI (`ci.yml`):** on PR and push — Postgres 16 service container, `pnpm i`, `drizzle-kit migrate`, `lint`, `typecheck`, `test`, `e2e`. Integration tests run against the service container, not Supabase. Add one nightly job against a Supabase staging project to catch pooler/version drift.

**Preview environments:** PR previews point at a Supabase branch database (Pro) or a dedicated `preview` schema. Never at production.

**Env vars (`.env.example`):** `DATABASE_URL` (pooler), `DIRECT_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_URL`, `APP_ENCRYPTION_KEY` (32-byte base64), `TRACKING_SECRET`, `CRON_SECRET`, `ALLOWED_EMAILS`, `RESEND_API_KEY` (fallback), `NEXT_PUBLIC_APP_URL`. No `NEXT_PUBLIC_` DB or Supabase keys — the anon key is not used at all.

**`vercel.json`:** 60-second cron on `/api/cron/tick` (requires Pro; Hobby limits cron frequency and function duration).

**Supabase project settings:** Data API off, Realtime off, Storage off, pooler mode transaction, connection limit sized to peak concurrent functions (10 users ≈ trivial). Keep `pg_stat_statements` on for slow-query review. Free tier pauses after inactivity — document the cold-start behaviour, run production on Pro.

**README:** local setup (`pnpm i`, `drizzle-kit migrate`, `seed-taxonomy`, `dev`), creating the first OWNER, creating Apify/Resend/IMAP credentials, sending-domain DNS records, how to rotate `APP_ENCRYPTION_KEY` (re-encrypt job), and a runbook (DEAD jobs, IMAP resync, re-import a run, merge duplicates, why a gate blocks a transition, what to do when the pooler is saturated).

## 15. Acceptance criteria (definition of done)

1. A non-allowlisted email cannot sign in; an allowlisted one can, via Google or magic link.
2. Settings → Integrations verifies real Apify, Resend, and IMAP credentials.
3. Taxonomy is seeded: 17 industries and ~50 business types; an ADMIN can add a business type under an existing industry and it appears in pickers immediately.
4. Creating a source with a real Apify actor renders its input schema as a form; a 1-item test run returns samples; field mapping auto-guesses email, name, and company; a classification preset applies industry/market/opportunity.
5. Running the source yields prospects with derived `company_size`, normalized geography, and correct counts; running twice adds zero duplicates.
6. CSV import maps columns, shows a dry-run of the first 200 rows, then imports 500 rows **as an async batch job** with a progress bar reaching 100% while the page stays responsive; counts valid/invalid/duplicate are correct and unrecognized enum rows appear in the error CSV without being coerced.
7. A 20k-row CSV import completes without an HTTP timeout, survives a page reload (progress is server-side), and reports a final count.
8. Tags can be created inline, bulk-applied, filtered, renamed, and deleted; duplicate labels merge instead of duplicating.
9. A prospect at NEW cannot be promoted to RESEARCHED or QUALIFIED until every gate requirement passes; blocked attempts show which requirements are missing and never mutate the stage.
10. Stage transitions outside the matrix return 422; LOST/DISQUALIFIED require a reason; every transition is audit-logged.
11. Setting priority to DISQUALIFIED sets stage to DISQUALIFIED and cancels queued sends.
12. The prospect drawer shows classification, gate checklist, timeline, emails, and notes; filters (industry, size, opportunity, service, stage, tag, follow-up due) return correct result sets; bulk actions cap at 5,000.
13. A 3-step sequence builds, activates, and enrolls only prospects passing the enrollment gate; preflight reports every exclusion reason.
14. Emails send only Mon–Fri 09:00–17:00 workspace time, never exceed the effective daily cap (min(per-user daily cap, warmup ramp of 5 × days since domain verification)) or 60/hour/workspace, never repeat within 24h to one prospect, and never reach a suppressed address.
15. First send moves stage to CONTACTED; step ≥2 moves CONTACTED → FOLLOW_UP; a reply stops the sequence and sets REPLIED; a bounce sets contactability BOUNCED without changing stage.
16. Opens and clicks are recorded; the unsubscribe link works logged out, suppresses the address, stops enrollments, and leaves the stage untouched.
17. A hard-bounce webhook and a complaint webhook each suppress the address and stop the sequence.
18. The dashboard shows the pipeline strip and follow-ups due; overdue next actions are visible; the research queue count matches the filtered list.
19. Exporting 50k prospects returns a download link from a job rather than blocking the request.
20. MEMBER cannot reach Settings, integrations, taxonomy writes, gate overrides, or prospect deletion (403 + hidden UI).
21. Every list screen has correct loading, empty, and error states and is usable at 375px, 768px, and 1280px.
22. All tests pass in CI; axe reports no serious or critical issues.
23. The app deploys to Vercel from GitHub against Supabase Postgres with the documented env vars and one cron; migrations are applied by GitHub Actions on `main` (never by the Vercel build), the runtime uses the pooler and the migration job uses the direct connection, and a fresh user can complete the core flows unaided.

Do not stop to ask questions. If a detail is unspecified, choose the option that is simplest, most secure, and most consistent with this document, and note it in the README's "Decisions" section.
