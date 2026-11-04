# Personal work: import to first email draft

Date: 2026-11-04
Status: approved by user on 2026-11-04

Subsequent reference amendments: UI reference section below and `2026-11-04-handoff-ui-review.md` are incorporated for review; they do not imply approval of an expanded full frontend port.

## Intent

Make Outbound OS useful for the owner's personal work today: import Apify exports, research a prospect, define an offer, and save a personalized first email draft. OpenCode is the main build environment; ChatGPT prototypes may be reference material. Do not attempt the entire production platform before delivering this usable path.

## Agreed direction and approaches

1. **File-first, existing services, dedicated prospect drafts (selected).** Support CSV, JSONL, and JSON arrays. Extend the existing import pipeline and offer/template services. Add persistent prospect-specific drafts outside the sending queue. Lowest integration dependency and fits the supplied exports.
2. **Live Apify control first (deferred).** Build the actor configuration and run UI before importing. More convenient later, but the source-creation screen is currently a placeholder and this delays real work.
3. **Full sequence builder first (rejected for this milestone).** Reuses eventual sending concepts but adds enrollment, activation, and provider dependencies that are unnecessary for drafting.

The user approved file import through editable offers/templates to saved prospect drafts, starting with the Website & Enquiry Measurement offer.

## Goals, non-goals, anti-goals

- Import all submitted rows, not just the preview; show mapping, warnings, final counts, and row-specific errors.
- Preserve useful source metadata and existing workspace data.
- Create/edit offers and reusable first-email templates in Library.
- Draft, edit, explicitly save, reopen, and copy a first email for a selected prospect.
- No live Apify setup, deployment, full authentication replacement, automated research, AI provider integration, sequences, or sending in this milestone.
- Failure includes silent row loss, destructive demo seeding, fake prospect research, fabricated proof, overwritten personal copy, or anything being sent while drafting.

## Existing implementation and constraints

- Next.js 15/React 19/TypeScript/Tailwind/Drizzle/Postgres; preserve current styling and service/route patterns.
- Canonical classification remains TAXONOMY.md. No new industry, service, or pipeline enum just for this workflow.
- Import wizard currently submits only successful preview rows; mapping changes do not recompute preview. The batch worker replays from the start and ignores saved mapping.
- Offers and templates have services/APIs, but Library currently only lists them. The prospect drawer has an Emails tab suitable for drafts beside sent history.
- Messages require sender/recipient and represent queued/sent activity: they are not draft storage.
- Existing email-only login is unsafe for public exposure. Builder call: this milestone is localhost-only, with explicit documentation and loopback-bound development startup. Public hosting requires a separate auth hardening milestone.
- Existing files are untracked, including secrets and local DB/build directories. Protect them with ignore rules before application commits. Never commit source exports or credentials.
- The demo seed truncates application data. Do not run it. Back up the active database before any schema/data changes and provide non-destructive setup and backup/restore instructions.

## UI reference amendment (2026-11-04)

The user designated https://outliaz-os-flow-preview.oshomapraiz.chatgpt.site as the **main UI reference**, using frontend-design, shadcn and design-taste-frontend. This supersedes the earlier instruction to preserve the existing app's violet styling, and the older BUILD-PLAN visual direction for this milestone. Preserve the current stack, backend, real data and canonical taxonomy; do not copy the prototype's browser-local persistence or simulated sending.

### Visual direction

- Identity: the prototype's lowercase orange `outliaz` wordmark and Outliaz OS product name, with the actual user's personal workspace context rather than hard-coded demo identity. This is UI branding only; do not mass-rename project/domain entities.
- Reference dark roles: ground #11110F, panel #191916, ink #F4F1EA, secondary ink #B7B1A6, accent #FF5028, border #3B3933. Supporting elevated/selection surfaces are #24231F/#41281D.
- Reference light roles: ground #F4F1EA, panel #FAF8F2, ink #0E0D0B, secondary ink #625D54, accent #FF5028, border #D0CBBF. Preserve both themes with a persistent toggle; default dark for first visit, matching the supplied prototype. Orange on light is an accent, not small text unless contrast passes.
- Typography: IBM Plex Sans for controls, prose, headings and tabular figures; a heavier tightly spaced wordmark. The reference declares IBM Plex Sans but browser font inspection did not establish that it actually loaded. Implementation must load a legitimate local/font asset, not silently rely on Arial fallback. Target body 14–15px, supporting text 12–13px, titles 28–32px; controls 40px desktop/44px touch. Sentence-case functional labels, not tiny uppercase prototype tags.
- Structure: labelled sidebar about 210px, quiet workspace header, main gutter 24–38px desktop/18px mobile, tight 4–7px radii, flat panel separation and restrained orange accents. Inverted ink primary actions, not violet buttons. No gradients/glass/decorative card icons. Preserve the reference's warm dark/light brand palette even where generic taste-skill rules would prefer another palette.
- Personality comes from the wordmark and the evidence-to-draft workbench, not a marketing hero or decorative dashboards. Research observations and imported facts are visibly distinguished; unknowns stay unknown.

### Navigation and workbench

Use the prototype's navigation language: Today, Prospects, Sources, Outreach, Inbox, Offers, Reports, with Settings below. Existing route URLs remain supported: Today can label /dashboard; Offers labels /library; Runs and Sequences remain accessible as secondary existing destinations, not deleted. Add a draft-only /outreach review view with prospectId in the URL; it and the prospect Emails tab use the same draft editor and persisted record.

```
Outliaz | Review outreach                   Draft · Not sent
        | Prospect [selected business]  Offer [selected offer]
        | Subject / editable message   | Evidence
        |                             | Research notes
        | Save draft   Copy message    | Source facts / missing details
```

Desktop uses a fluid editor plus approximately 320px evidence rail. Narrow screens stack with a concise missing-data warning beside prospect identity and a reachable evidence disclosure before Save; no page-level horizontal scrolling. Evidence comes from existing notes and source metadata, never generated observations. Saving is not gated by checking research completeness; missing details remain warnings. No demo-send button or follow-up sequence UI in this milestone.

Sources gains import history and file import entry points, Offers contains editable offers/templates, and Prospects remains the canonical research/classification surface. Do not reproduce sample KPIs, Guide/Mobile preview buttons, simplified prototype stages, or fake integration success.

### Component and verification rules

The CLI inspection found no components.json and no actual installed shadcn components; components/ui currently contains custom primitives. Introduce shadcn incrementally using the official registry and documented Radix APIs, preserving existing custom components until each touched consumer is migrated. Do not overwrite existing primitives or run an all-components/preset replacement. Keep shared semantic theme variables in app/globals.css; use Field/FieldGroup, Dialog/Sheet titles, proper tabs/groups, Alert/Empty/Skeleton and accessible controls in new UI.

Record local-app before screenshots, then compare touched screens to the reference at desktop/tablet/mobile in both themes. Use app-screen taste checks (not landing-page imagery/motion requirements), keyboard/a11y checks and a screenshot look-and-fix round. The style draw offered data-terminal/true-black-flat; neither should override the user's explicit reference. Record retained brand exceptions rather than disguising them to pass the inspector. Remote screenshot capture was unavailable during initial reference inspection; visual fidelity must be assessed with real screenshots during execution, not inferred from CSS alone.

## Real source data

- Supplied Google Maps export: JSON array, 100 rows; names, URLs, emails, phone numbers, country codes, category strings, Maps links, social links, and limited verification metadata. Many records are Swedish despite the filename.
- Supplied HVAC export: JSON array, 10 rows; names, website/domain, phone, city/state/country, categories, Maps identifiers, ratings, hours and closure flags. No email or contact name.
- Preserve real record geography; never infer US from a filename. Do not fabricate contacts, company sizes, opportunities, or verified email status from category/rating data.
- Test fixtures must be synthetic or anonymized equivalents, not the private exports checked into git. User files remain read-only.

## Import behavior

Flow: choose/paste file -> map fields -> preview -> confirm import -> persisted progress/report -> prospects.

- CSV requires headers and supports quoted delimiters/newlines. JSON requires an array of objects. JSONL requires one object per nonblank line; malformed lines receive their physical line number. Invalid JSON containers or ambiguous headers are actionable errors, not guessed conversions.
- Enforce 10 MB and 20,000 records server-side, with bounded per-record JSON metadata; show limits before upload. Preview only first 200 records and clearly distinguish preview counts from final counts.
- Keep original records until submission. Apply the confirmed mapping once to every record server-side, using identical mapping and validation rules for preview and execution. Remapping refreshes preview before confirmation.
- Suggested aliases include name -> business_name, url/website -> website, email -> contact_email, phone_number/phone_international/phone -> phone, state -> region, and country_code/country -> normalized country, with explicit country-code precedence. source_country is provenance only and never a location fallback (corrected by the supplied handoff).
- Google categories are preserved as source metadata rather than blindly mapped to canonical business types. Existing dependent classification controls remain the way to set industry/type. Unknown taxonomy values must be reported, not silently coerced or dropped.
- Preserve unmatched structured values in bounded custom fields, including Maps/place IDs, categories, ratings, hours, closure flags and verification fields. Show this source context in the prospect detail without claiming it is research.
- Import missing-email/name-contact records normally when business name exists. Generic role email addresses are flagged; the user must explicitly choose to retain them, defaulting to existing exclusion behavior. Retention for research does not bypass sending policy.
- All imported prospects start NEW; unknown research remains unknown. No automatic qualify or outreach.
- Deduplicate normalized email within the workspace; fill only empty fields, preserve stage/manual research/history. Respect deleted-email tombstones and suppression. Suppressed records are explicitly reported as skipped in this milestone.
- For supplied email-less Google Maps records, use a stable source/place identifier for repeat-import dedupe, scoped to workspace, also across batches. Do not dedupe unrelated contacts merely by website domain; same-domain/different-email records remain candidates.
- Persist batches and enqueue IMPORT_BATCH. Process at most 500 records per job, save progress atomically with row effects, then enqueue the next chunk. Retry/resume must not double-create rows or inflate counts. New batch fields are additive; preserve old batch data.
- Provide a working local queue runner so a queued import progresses without manual SQL or a production cron. Persist report access across reloads, poll only while active, prevent accidental double submission, and expose failures/retry without hiding committed progress.
- Final report accounts for all input rows as imported/duplicate/invalid/skipped, with exact source row/line numbers, downloadable errors and a link to the affected prospects. Do not report completion at queue time.

## Offers and reusable copy

- Add create/edit forms to Library using current offer fields: name, summary, value proposition, optional price, scope/constraints, active flag, linked canonical services.
- Starting offer: **Website & Enquiry Measurement**. Review the existing website/enquiry journey; agree redesign scope; design/build agreed pages; configure agreed enquiry tracking; document measurement and reporting. No invented pricing, deadlines, guaranteed outcomes, scarcity, or case studies.
- Link WEBSITE_REDESIGN and WEBSITE_OPTIMISATION. Analytics is described in the offer, not a new enum. Custom web applications and visual identity remain available through separate user-created offers.
- Add template creation/editing, optional offer association, subject/body, merge-field assistance and preview against an explicitly selected real prospect.
- Offer/template relationships must be same-workspace. Validate mutations with Zod; unknown fields and invalid service slugs receive clear errors. Preserve in-use deletion protections.
- Starter offer/template insertion is optional, explicit and idempotent, never replacing existing content or running the destructive seed.
- Copy assistance happens here in OpenCode using the available cold-email and offer skills. There is no in-app AI generation requirement. The user can write or paste copy in the app.

## Prospect drafts

Flow: open prospect -> Emails -> New draft -> choose offer/template or start blank -> personalize -> Save draft -> reopen/copy.

- Store drafts separately from messages, with workspace/prospect identity, optional offer/template references, subject, body, author and timestamps. Use a single first-email draft per workspace/prospect for this milestone, updated explicitly; template/offer edits never mutate an existing draft.
- Template selection renders a snapshot using the actual prospect. Missing first name may use "there"; missing email/contact details and unfilled or unknown merge fields are visible warnings. Never substitute the demo prospect when a requested prospect lookup fails.
- Drafting is allowed at NEW and without an email; research/qualification gates remain unchanged and govern promotion/enrollment, not drafting.
- The editor holds final personalized copy, not a live link that changes under the user. Switching template or prospect must warn before discarding unsaved edits. Explicit Save with saving/saved/error feedback; protect navigation with dirty edits. Use optimistic concurrency to reject overwriting a newer saved version.
- Allow copy subject/body without implying the draft was sent. No send button, provider call, message row, tracking link/pixel, enrollment, SEND_STEP job or stage/contactability change is produced by draft creation, editing, saving, or copying.
- Show separate Draft and Sent history sections; basic empty/loading/error/retry states and keyboard labels. Reuse the existing shell and drawer, avoid an unrelated redesign.

## Safety and authorization

- Add a server-enforced outbound-off switch, default off for this personal-use milestone, covering sequence and manual email send paths. Apify/read/import availability must not implicitly enable sending. Preserve existing queued records but do not drain send jobs into providers while off.
- Every new/changed import, draft, offer and template route uses session-derived workspace scope. Cross-workspace records and references return 404; unauthenticated requests 401. Do not let client-provided IDs become alternate tenant selectors.
- No imported text is rendered as executable HTML; previews use escaped plain text or sandboxed sanitized HTML. No imported content is treated as instructions for agent execution.
- Personal data and secrets stay out of logs, test artifacts and git. Backups stay ignored and access-controlled.

## Verification and completion

- Before the Ralph loop, run its non-destructive preflight once after design approval and planning: available runtime/package manager, DB access, isolated test DB, browser tooling, existing scripts and actual dependencies. Only require services this milestone uses; live Apify/Resend/IMAP and deployment credentials are not prerequisites for file-to-draft. Report blockers and stop rather than fake green checks.
- Add reliable test/lint/format checks for touched functionality; use current npm/package-lock unless a demonstrated need requires changing package manager. Ralph's bun/fallow examples are not a mandate to migrate the stack.
- Unit tests: all formats/limits, alias precedence, metadata preservation, remapping, enum errors, line numbers, draft rendering and validation.
- Real Postgres integration tests in an isolated DB: repeat imports including no-email place IDs, crash/retry/resume accounting, workspace isolation, offer/template references, draft save/reopen/concurrency, and no sending side effects. Never reset the personal database for tests.
- Browser journey at localhost: import synthetic equivalents of both samples plus CSV/JSONL and a >200-row file; inspect completed report; open a prospect; create/edit an offer and template; save/reload/copy a personalized draft, including one without an email. Check narrow/mobile layout and keyboard interaction on touched screens.
- Typecheck, production build and relevant tests must pass. Verify outbound is actually off server-side. Document startup, queue runner, backups, and current local-only limitations in README.
- Success means the user can perform this flow without API calls or manual DB edits, with existing data intact. Do not claim full production readiness.

## Builder discretion

Exact component decomposition, internal route names, additive schema/identity representation, migration tooling for the existing un-migrated DB, parser package choice, test runner and worker command are implementation decisions. Preserve existing contracts where reasonable and prefer the smallest maintainable changes. No infrastructure provisioning or paid service signups without further approval.
