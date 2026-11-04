# Personal Import-to-Draft Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the owner import real Apify exports, maintain offers/templates, and save a personalized first email per prospect locally without sending anything.

**Architecture:** Keep the existing Next.js app and Drizzle services. Use one parsing/mapping contract for file preview and asynchronous import, transactional chunk processing with persistent source identity, and a separate draft table rather than queued messages. Reuse Library and the prospect drawer with small focused client editors.

**Tech Stack:** Next.js 15, React 19, strict TypeScript, Tailwind v4, Drizzle/postgres-js, npm; add Vitest, Playwright, csv-parse and targeted lint/format tooling.

**Spec:** `docs/superpowers/specs/2026-11-04-import-to-draft-design.md`

**UI amendment:** The ChatGPT prototype is the main UI reference, not merely flow inspiration. Follow the spec's UI reference amendment (2026-11-04), including its brand palette, IBM Plex Sans, navigation and shared evidence/draft workbench. The frontend-design/shadcn/design-taste-frontend app-screen rules apply; explicit reference choices take precedence over generic style draws. This amendment awaits user review together with the plan.

## Global Constraints

- Supplied-source amendment: read `docs/superpowers/specs/2026-11-04-handoff-ui-review.md` and the five handoff documents plus dist/index.html in `/home/swiss/Desktop/outliaz-os-handoff`. Local runnable source supersedes the hosted preview. Review the UI/experience before implementing; maintain BUILD_PROGRESS.md. No expanded frontend/backend scope is implied by the attached prompt.
- Country provenance correction: use normalized business country_code/country only, never source_country or filename. An explicit targetCountry defaults to US; unknown/mismatched locations are excluded and counted separately. Keep other countries deliberately selectable, not silently inferred.
- Add real import stop/correction/retry interactions to Tasks 3–4: stop after current chunk, retain completed work, distinguish unprocessed remainder, inline correction of missing business name, and retry only unresolved rows. Scope every action to workspace and batch. Adjust existing row outcomes/counters transactionally; never re-add successes. Keep temporary-error scenario controls in synthetic tests/reference only.

- No live Apify setup, deployment, full authentication replacement, automated research, AI provider integration, sequences, or sending in this milestone.
- Enforce 10 MB and 20,000 records server-side, with bounded per-record JSON metadata; show limits before upload.
- Preview only first 200 records and clearly distinguish preview counts from final counts.
- Process at most 500 records per job, save progress atomically with row effects, then enqueue the next chunk.
- All imported prospects start NEW; unknown research remains unknown. No automatic qualify or outreach.
- Drafting is allowed at NEW and without an email; research/qualification gates remain unchanged and govern promotion/enrollment, not drafting.
- Template/offer edits never mutate an existing draft.
- Every new/changed import, draft, offer and template route uses session-derived workspace scope.
- User files remain read-only. Never reset the personal database for tests.
- Public hosting requires a separate auth hardening milestone. Local dev must bind to 127.0.0.1.
- No invented pricing, deadlines, guaranteed outcomes, scarcity, or case studies.
- Keep npm and package-lock; no infrastructure provisioning or paid service signups.
- Match the designated prototype in the shell and touched import, prospect, offer and draft screens; no unrelated Reports/Inbox feature expansion or marketing-page effects.
- User-requested icons: follow the Lucide/shadcn icon requirement in the handoff UI review document. Use icons on navigation, import/recovery, editing/save/copy and theme/sidebar controls; retain visible labels, accessible icon-only names/tooltips, no decorative icon tiles. Verify collapsed rail meanings and keyboard/touch access in Task 1b and workflow tests.
- Icon refinement: plain minimalist Lucide outlines, 1.5px stroke and monochrome currentColor; no backgrounds/containers/decoration. Prioritize navigation and compact utility controls. Labelled action buttons are text-only by default; show icons only where they materially aid recognition. This supersedes blanket icon coverage in the preceding item.

## Review Focus

- Mixed export aliases and blank country fields must not replace a real country code with filename assumptions (Task 2).
- Double-click submission and worker interruption must not create duplicate batches/rows or inflated final counts (Tasks 3–4).
- Large metadata, malformed JSONL lines and spreadsheet formula text must be bounded/reported safely, not executed or silently lost (Tasks 2–4).
- Deleting/editing a source template and concurrent browser tabs must not overwrite saved personalized copy (Tasks 5–7).
- Existing queued send jobs and manual reply paths must remain inert even when real provider credentials exist (Tasks 1 and 8).

## File and interface map

- `lib/import/{types,parse,mapping,validate}.ts`: shared raw-record types, file decoding, mappings, validation; no database or provider imports.
- `lib/services/{import,import-runner,prospects,common}.ts`: transactional normalization, dedupe, batch progress, scoped prospect reads/writes. Extend only necessary write helpers to accept a transaction executor.
- `lib/db/schema.ts`, `migrations/0001_personal_workflow.sql`, `scripts/migrate-personal.ts`: additive upgrade for the existing initialized database, without attempting to recreate its tables. Fresh integration DB starts from current schema; migration tested against pre-upgrade schema separately.
- `lib/security/outbound.ts`, `lib/services/sending.ts`, `lib/jobs/{queue,worker}.ts`: fail-closed outbound switch, safe import-only local runner, lease recovery.
- `scripts/{preflight,backup-db,worker}.ts`: read-only diagnostics, backup and bounded worker loop; restore is documented as an explicit user action, never automatic.
- `components/import-wizard.tsx`, `app/(app)/prospects/import/page.tsx`, `app/api/prospects/import/**`: file workflow/report.
- `components/library/{offer-editor,template-editor,library-manager}.tsx`, `lib/validation/library.ts`, `lib/services/library.ts`, existing Library/offers/templates routes: editable assets and safe preview.
- `lib/{validation/drafts,services/drafts}.ts`, `components/prospects/draft-editor.tsx`, `app/api/prospects/[id]/draft/route.ts`: first-email draft persistence and editor.
- `tests/{unit,integration,e2e,fixtures}/**`, `vitest.config.ts`, `playwright.config.ts`: synthetic inputs and isolated verification.

Common contracts (export from `lib/import/types.ts`):

```ts
type ImportFormat = 'CSV' | 'JSON' | 'JSONL';
type RawRecord = Record<string, unknown>;
type SourceRow = { rowNumber: number; record: RawRecord | null; parseError?: string };
type FieldMapping = Record<string, string>; // canonical destination, __custom__, or __ignore__
type RowIssue = { rowNumber: number; code: string; message: string };
type RowOutcome = { rowNumber: number; kind: 'imported' | 'duplicate' | 'invalid' | 'skipped'; prospectId?: string; issues: RowIssue[] };
type ImportOptions = { allowRoleAddresses: boolean; targetCountry: string };
type ImportSubmission = { requestId: string; fileName: string; format: ImportFormat; content: string; mapping: FieldMapping; options: ImportOptions };
```

Keep original content only in the client until submit; persist parsed source rows and mapping in the batch, not another full raw-content copy. Existing non-file Apify service contracts remain working.

---

### Task 1: Safe local foundation and outbound-off behavior

**Files:** Create `.gitignore`, `README.md`, `lib/security/outbound.ts`, `scripts/preflight.ts`, `scripts/backup-db.ts`, `vitest.config.ts`, `tests/unit/outbound.test.ts`; modify `package.json`, `.env.example`, `lib/services/sending.ts`, `.github/workflows/ci.yml`.

**Interfaces:** `outboundEnabled(): boolean` accepts only `OUTBOUND_ENABLED=true`; `requireOutboundEnabled(): void` throws `AppError('OUTBOUND_DISABLED', ..., 403)`. `npm run preflight` emits redacted installed/auth/connectivity checks and exits nonzero on required blockers. `npm run db:backup` uses pg_dump with restrictive permissions and fails rather than producing a false-success backup.

- [ ] **Step 1: Preflight gate before implementation.** Read active config and env variable names without printing values; non-destructively check Node/npm, DB readiness, dump tooling, browser CLI, isolated test DB capability and Git identity. No live provider/deploy authentication needed. Report exact remedies for failures and STOP until resolved. Existing missing Git identity requires the user's name/email; do not invent or globally configure it. No need to install bun/fallow just for this project.
- [ ] **Step 2: Write failing tests.** `outbound.test.ts`: unset/false/garbage switches deny; explicit true allows. Spy on provider sending and assert both `processSendStep({enrollmentId, force:true})` and manual-send service cannot call it or insert a message while disabled. Add Vitest using npm and run `npm run test -- tests/unit/outbound.test.ts`; expect red on absent guard.
- [ ] **Step 3: Implement minimal foundation.** Guard actual sequence and manual sending at service entry and immediately before provider dispatch. Ignore `.env*` except example, DB/build/dependency directories, backups, private exports and browser artifacts. Add `db` script for existing `scripts/db.ts`, loopback dev/start, tests/typecheck/lint/format scripts. Use ESLint flat config for touched code and Prettier checks without unrelated bulk reformatting. Remove CI lint-error suppression and add isolated test setup. Document local-only authentication limitations and destructive seed warning.
- [ ] **Step 4: Verify.** Run unit tests, typecheck, lint/format on changed files. Run read-only backup and verify archive listing using `pg_restore --list`; do not restore into the personal DB. Start DB only if no existing instance owns the configured port. Use an isolated worktree only after a safe tracked baseline exists; never lose the currently untracked app trying to create one.
- [ ] **Step 5: Commit.** Stage only reviewed app/config/tests/docs source files; use `git diff --cached --stat` and secret/path inspection before committing. Establish the existing-source baseline explicitly without including `.env`, private exports, generated files or DB data; then commit safety changes separately when feasible.

### Task 1b: Reference-led shell and incremental shadcn foundation

**Files:** Create `components.json`, `DESIGN.md`, `tests/e2e/shell.spec.ts`, required shadcn component source and legitimate local font assets; modify `app/globals.css`, `app/layout.tsx`, `components/{app-shell,nav-meta,command-palette}.tsx`, `package.json`. Keep existing custom UI files until touched consumers migrate.

**Interfaces:** Existing AppShell props and hrefs remain compatible. Theme persists with dark default for first visit and no hydration flash; semantic roles map to spec reference hex values. DESIGN.md records tokens, source reference, typography, brand exceptions and component recipes.

- [ ] **Step 1: Record before and write failing browser checks.** Inspect local app before changes with screenshots at 1440/768/390 and gather reference screenshots if available. Tests assert product/actual workspace identity, Today/Prospects/Sources/Outreach/Inbox/Offers/Reports labels, supported old routes, theme persistence, mobile navigation, one shell per screen, keyboard focus restore and no overflow. No assertions of a fictional sample user's name.
- [ ] **Step 2: Run red checks.** `npm run test:e2e -- tests/e2e/shell.spec.ts`; confirm failures on reference shell/theme behavior.
- [ ] **Step 3: Implement narrowly.** Run `npx shadcn@latest info --json`, inspect existing custom primitives, and use `npx shadcn@latest docs` plus fetched docs before using each official component. Initialize Radix config without replacing global CSS or existing custom files; inspect CLI dry runs and every added file. Add only needed Button/Field/Input/Textarea/Select/Combobox/Tabs/Dialog/Sheet/Alert/Empty/Skeleton/Badge/Separator/Progress components, sharing semantic tokens and documented variants. Review any overlapping file before adding; no --overwrite. Load IBM Plex Sans locally, apply exact reference roles, 210px labelled sidebar, 24–38px gutters and 4–7px radii. Use actual workspace identity, orange wordmark and inverted primary action. Sidebar uses existing hrefs with reference labels; link Outreach to /outreach; retain Runs/Sequences in secondary navigation. No simulated badges, preview tools or decorative metrics. Replace redundant nested AppShell in touched route pages only.
- [ ] **Step 4: Verify the design as well as tests.** Run shell tests/typecheck, taste lint/inspect --app on touched screens, screenshot both themes at 1440/768/390 and inspect every image. Record warm-brand exceptions; do not adopt the conflicting random style draw or alter brand palette to silence checks. Fix top three visual issues; verify font really loaded and small text contrast meets 4.5:1. If browser tooling is unavailable, report that blocker rather than claiming visual verification.
- [ ] **Step 5: Commit.** `feat: adopt Outliaz prototype shell and UI tokens`.

### Task 2: Consistent CSV/JSONL/JSON parsing, mapping and validation

**Files:** Create `lib/import/{types,parse,mapping,validate}.ts`, `tests/unit/import-files.test.ts`, `tests/fixtures/apify-records.ts`; modify pure normalization in `lib/services/import.ts` and `lib/taxonomy/enums.ts` only as needed.

**Interfaces:** `parseImport(content: string, format: ImportFormat): { headers: string[]; rows: SourceRow[] }`; `guessFieldMapping(headers: string[]): FieldMapping`; `mapRecord(record: RawRecord, mapping: FieldMapping): RawRecord`; `validateImportRow(row: SourceRow, mapping: FieldMapping, options: ImportOptions): { data: RawRecord | null; issues: RowIssue[]; warnings: RowIssue[] }`. Validation returns canonical fields plus bounded custom metadata and never mutates input.

- [ ] **Step 1: Write failing tests.** Synthetic equivalents of both supplied formats; 201 valid rows remain 201 while preview slices to 200; quoted CSV newlines/BOM; JSON nested metadata; JSONL blank lines and bad physical line 4; reject non-object JSON elements; reject >10*1024*1024 UTF-8 bytes and >20_000 records; duplicate/empty CSV headers fail. Country `SE` wins over blank country; source_country=US alone leaves location unknown, excluded from targetCountry=US along with explicit SE records. Phone/website aliases have deterministic precedence. Remapping name to business_name changes preview. Generic email retention requires opt-in. Unknown enum values fail; Google categories are metadata. Missing contacts stay null; no names/size guessed. Per-record metadata >64 KiB fails clearly; prototype-like custom keys cannot pollute objects. Formula-like text stays text and error CSV neutralizes formula prefixes.
- [ ] **Step 2: Run red tests.** `npm run test -- tests/unit/import-files.test.ts`; confirm failure on missing parsing/mapping functions.
- [ ] **Step 3: Implement.** Use `csv-parse/sync` with record/field bounds; parse JSONL independently by physical line. Union JSON headers across records. Prefer canonical aliases, preserve unmapped original keys under sanitized bounded metadata keys, expose deliberate ignore/custom mapping. Country-code precedence is explicit; category is not business_type by default. Website strips UTM parameters and requires http(s). Share validators with future execution, including canonical enum/industry-type validation deferred to DB lookup when necessary. Never mark provider `email_quality=good` as VERIFIED automatically.
- [ ] **Step 4: Verify.** Run unit file, typecheck and focused lint/format. Assert no test requires private file paths or real business contact data.
- [ ] **Step 5: Commit.** `feat: parse and validate complete prospect export files`.

### Task 3: Durable, idempotent batch import and local worker

**Files:** Modify `lib/db/schema.ts`, `lib/services/{import,import-runner,prospects,common}.ts`, `lib/jobs/{queue,worker}.ts`; create `migrations/0001_personal_workflow.sql`, `scripts/migrate-personal.ts`, `scripts/worker.ts`, `tests/integration/import-batches.test.ts`, `tests/helpers/database.ts`.

**Interfaces:** `createFileImport(ctx: Ctx, input: ImportSubmission): Promise<{ batchId: string; rowsTotal: number }>`; `processFileImportChunk(batchId: string): Promise<void>`; `getFileImport(ctx: Ctx, batchId: string): Promise<ImportReport>`; `retryFileImport(ctx: Ctx, batchId: string): Promise<void>`. `ImportReport` contains status/format/total/processed/imported/duplicate/invalid/skipped/errors and scoped affected prospect IDs via membership. Keep old batch support as explicit version 1; new batches set version 2 and use new processing.

- [ ] **Step 1: Write failing integration tests.** Isolated DB fixture refuses personal DATABASE_URL; exercises 501 rows in two chunks, concurrent duplicate requestId, place-ID repeat import with no email across batches, normalized-email merge preserving stage, tombstones, suppression and role-email choices, source row numbers, type/industry mismatch, two workers on same chunk, crash before commit and retry after commit. Assert `imported+duplicate+invalid+skipped===total`, no progress inflation and no extra messages/enrollments. Different contacts sharing domain remain separate candidates. Existing version-1 batch is still readable/processable.
- [ ] **Step 2: Run red tests.** `npm run test:integration -- tests/integration/import-batches.test.ts`; failure expected for missing new contracts, never from connecting to personal DB.
- [ ] **Step 3: Implement additive persistence and atomic writes.** Add batch version/options/requestId/skipped fields; source rows permit structured unknown values and physical row numbers. Add workspace-scoped `prospect_import_identities` unique on workspace/provider/place key, and `import_batch_rows` unique on batch/row with outcome/prospect/issues. Resolve deleted-source identity as skipped, not resurrected. Existing no-email records without place IDs have no cross-batch hard identity; flag candidate when appropriate rather than inventing identity. Transaction-lock each batch, process <=500 rows, write prospect effects/row outcomes/progress/next deduped job together. Thread Drizzle transaction executor through only touched helpers so global db calls cannot leak outside the transaction; use savepoints/upsert for row-level unique conflicts. Empty-field merge must not alter researched/manual data. DB errors abort retryably; validation failures are accounted row outcomes. Jobs have recoverable leases, exhausted imports become FAILED with persisted progress, scoped retry resumes safely. Local runner defaults to IMPORT_BATCH only, polling every second, graceful shutdown; disabled send jobs stay pending rather than completed/dead.
- [ ] **Step 4: Verify migration and worker.** Backup first; review exact additive SQL before applying. Migration runner uses DIRECT_URL, an advisory lock and own migration ledger; never db:push or a baseline CREATE over existing tables. Verify old/new data and counts survive migration, rerun is no-op, worker recovers stale claim, final report persists. Run integration tests and unit tests.
- [ ] **Step 5: Commit.** `feat: process resumable prospect import batches safely`.

### Task 4: Usable import wizard and persistent report

**Files:** Modify `components/import-wizard.tsx`, `app/(app)/prospects/import/page.tsx`, `app/(app)/sources/page.tsx`, `app/api/prospects/import/{route.ts,preview/route.ts,[batchId]/route.ts}`, `lib/services/prospects.ts`, `components/prospects-table.tsx`; create `app/api/prospects/import/[batchId]/{retry,errors}/route.ts`, `tests/integration/import-api.test.ts`, `tests/e2e/import.spec.ts`.

**Interfaces:** Preview POST accepts `{ fileName, format, content, mapping?, options }` and returns `{ headers, mapping, totalRows, previewRows, warnings, invalid, truncated }`. Import POST accepts `ImportSubmission`. Status/error/retry endpoints use Task 3 and session-derived scope. Prospects list accepts `importBatchId` and filters through batch-row membership; completion link points there. URL `?batchId=` reopens progress/report.

**Recovery amendment interfaces:** `stopFileImport(ctx, batchId): Promise<ImportReport>` sets a persisted stop request, honored between <=500-row chunks, leaving queued remainder counted as unprocessed. `correctImportRow(ctx, batchId, rowNumber, patch: {businessName: string}): Promise<ImportReport>` and `retryImportRows(ctx, batchId, rowNumbers: number[]): Promise<ImportReport>` touch unresolved rows only, atomically revise counters and enqueue work with stable dedupe keys. Add POST `/api/prospects/import/[batchId]/stop` and `/api/prospects/import/[batchId]/rows` with strict discriminated action schema. Report adds `excludedCountryMismatch`, `excludedCountryUnknown`, `unprocessed` and `stopped`; exclusions are subsets of skipped, never double-counted. Test stop/return, corrected-row retry and double retry without readding successes. Add failed-row JSON download alongside safe error CSV, with bounded original records and exact reasons.

- [ ] **Step 1: Write failing tests.** CSV/JSONL/JSON file chooser and paste; changed mapping recomputes preview; 201 records produce total 201 not 200; double-click one requestId returns same batch; active polling stops on DONE/FAILED; reload mid-import returns same progress. Empty/malformed/oversize inputs report errors without 500. Cross-workspace import status/errors/retry and batch filter return 404; unauthorized 401. Error CSV handles formula-prefixed text safely. Mixed valid/invalid JSONL accounts every nonblank source line.
- [ ] **Step 2: Run red tests.** `npm run test:integration -- tests/integration/import-api.test.ts` and `npm run test:e2e -- tests/e2e/import.spec.ts` using synthetic fixtures and isolated DB.
- [ ] **Step 3: Implement wizard/API.** Strict Zod request validation and actual byte limits. Keep full source in client, never submit previewRows as input. Require parsed preview and mapping review before confirmation; disable invalid navigation shortcuts. Poll at 2s only while running; show queued/processed/final separately and retain batch URL on reload. Provide exact issue rows, retry, downloadable report and imported-prospect link. Display role-email toggle with warning. Add scoped paginated import history and import entry point on Sources using real batches, not simulated Apify state. Match the reference import panel hierarchy using Task 1b tokens/shadcn. Remove redundant AppShell in import page since parent layout owns shell. Escape all displayed records, label controls, focus errors and use aria-live progress.
- [ ] **Step 4: Verify.** Run API/E2E, typecheck, focused lint/format. Browser check at 375px and desktop; keep local app and import worker running against personal DB only for user data, never synthetic test resets.
- [ ] **Step 5: Commit.** `feat: import complete exports with mapping and progress reports`.

### Task 5: Editable offers/templates and honest starter content

**Files:** Modify `app/(app)/library/page.tsx`, `lib/services/library.ts`, `lib/email/render.ts`, existing `app/api/offers/**`, `app/api/templates/**`; create `lib/validation/library.ts`, `components/library/{library-manager,offer-editor,template-editor}.tsx`, `lib/email/starter.ts`, `app/api/library/starter/route.ts`, `tests/unit/library-validation.test.ts`, `tests/integration/library.test.ts`.

**Interfaces:** Keep existing offer/template functions and field names with strict Zod schemas: offer name 1–160, price <=120, bounded text; template name 1–160, subject 1–150, body 1–8000. `createStarterAssets(ctx: Ctx): Promise<{ offerId: string; templateId: string }>` is explicit and concurrency-idempotent through a workspace-unique starter key. `previewTemplate(template, prospect)` receives real prospect or explicit generic sample only; missing requested prospect is 404, never a demo fallback.

- [ ] **Step 1: Write failing tests.** Create/edit persisted offers and templates; unsupported properties/services fail; cross-workspace offerId/prospect/template reads/writes return 404; archived referenced offers/templates rejected for new selection. Starter action twice (including parallel requests) creates one pair and preserves edited copy. Template deletion/change cannot change existing drafts (Task 6 regression). Merge rendering distinguishes missing known fields from unknown syntax, warns on unknown custom fields, and safely escapes imported markup. No demo company/footer/opt-out link in personalized draft preview.
- [ ] **Step 2: Run red tests.** `npm run test -- tests/unit/library-validation.test.ts` and `npm run test:integration -- tests/integration/library.test.ts`.
- [ ] **Step 3: Implement Library editors and starter action.** Preserve existing list/rules, add create/edit and offer association, selected-prospect preview and merge-field help. Starter offer is Website & Enquiry Measurement, services WEBSITE_REDESIGN/WEBSITE_OPTIMISATION, scope exactly from approved design, price unset. Starter subject `website and enquiries`; body uses approved question about tracking quote requests, describes redesign plus tracking, asks permission for a short review. Fill signature from real user name, not a fake agency; blank/unavailable signature is a warning. No unapproved guarantee or invented research. Include clear Save/error/retry/empty states and dirty-form protection.
- [ ] **Step 4: Verify.** Unit/integration tests, typecheck, lint/format. Check no frontend import pulls node crypto/server DB into client bundle; move shared pure merge renderer away from tracking crypto if necessary.
- [ ] **Step 5: Commit.** `feat: edit offers and first-email templates in library`.

### Task 6: Separate, scoped first-email draft persistence

**Files:** Modify `lib/db/schema.ts`; create `migrations/0002_prospect_drafts.sql`, `lib/validation/drafts.ts`, `lib/services/drafts.ts`, `app/api/prospects/[id]/draft/route.ts`, `tests/integration/drafts.test.ts`, `tests/unit/draft-validation.test.ts`.

**Interfaces:** `getDraft(ctx: Ctx, prospectId: string): Promise<Draft | null>`; `prepareDraft(ctx: Ctx, prospectId: string, input: {offerId?: string; templateId?: string}): Promise<{subject: string; bodyMd: string; warnings: string[]}>` (read-only); `saveDraft(ctx: Ctx, prospectId: string, input: {subject: string; bodyMd: string; offerId?: string|null; templateId?: string|null; expectedVersion: number}): Promise<Draft>`. GET draft endpoint returns draft/null; POST with `action:'prepare'` returns snapshot, PUT saves. `Draft` includes id/prospectId/workspaceId/subject/bodyMd/offerId/templateId/version/createdAt/updatedAt/authorUserId. Empty draft expects version 0; concurrent conflict is 409.

- [ ] **Step 1: Write failing tests.** Save at NEW without email; subject/body bounds; reload exact personalized text; two version-0 creates yield one success and one 409; update stale version fails without mutation. Cross-workspace prospect/offer/template and deleted prospect are 404. Template edits/deletion preserve draft text and optional FK clears appropriately. Assert message/enrollment/jobs/stage/contactability unchanged and provider spy never called for prepare/save/read.
- [ ] **Step 2: Run red tests.** `npm run test -- tests/unit/draft-validation.test.ts` and `npm run test:integration -- tests/integration/drafts.test.ts`.
- [ ] **Step 3: Implement.** Add workspace/prospect-scoped draft table, unique first draft per prospect, version default 1 and indexed workspace/prospect FKs; optional offer/template references SET NULL, text snapshots retained. Same-workspace checks occur within save transaction. Optimistic update uses version in WHERE; empty insert handles concurrent uniqueness as 409. Validate strict inputs, audit metadata only, no copy in logs. Prepare from selected template or blank; no need for researched/qualified stage and no sending imports. Add no-store responses and same-origin checks to new mutation routes.
- [ ] **Step 4: Verify.** Additive migration after backup, unit/integration tests; check saved copy survives template changes and repeat migration is no-op.
- [ ] **Step 5: Commit.** `feat: save versioned first-email drafts per prospect`.

### Task 7: Draft editor in prospect context

**Files:** Create `components/prospects/draft-editor.tsx`, `components/prospects/draft-workbench.tsx`, `app/(app)/outreach/page.tsx`; modify `components/prospect-drawer.tsx`, `lib/services/prospects.ts` only for source-context exposure if absent; create `tests/e2e/draft-workflow.spec.ts`.

**Interfaces:** `<DraftEditor prospectId={string} onDirtyChange={(dirty:boolean)=>void} />` uses Task 6 endpoints and Task 5 asset lists. `<DraftWorkbench prospectId={string} />` composes the same editor with scoped evidence (existing notes/source facts). /outreach?prospectId=... and the drawer edit the same persistent draft, not separate copies. Draft and Sent history are distinct sections in Emails tab. Show source metadata in an expandable read-only Overview section.

- [ ] **Step 1: Write failing browser tests.** Open no-email prospect, choose offer/template, render actual business with fallback greeting, edit/save/reload/copy exact subject/body. Missing email warning does not block saving; no send CTA. Template change, tab/prospect change, drawer close and page leave warn on dirty edits, cancellation preserves text. Switching templates after save asks before replacing existing copy. Conflicting save offers reload or copy-local-text recovery without silently overwriting. Clipboard unavailable shows selectable text and an honest error, not a false Copied toast.
- [ ] **Step 2: Run red tests.** `npm run test:e2e -- tests/e2e/draft-workflow.spec.ts`.
- [ ] **Step 3: Implement.** Use the prototype's draft-review workbench: prospect/offer selection, Draft · Not sent status, editable message beside a roughly 320px evidence rail. Add /outreach with URL-synced prospect selection and a clear empty state; drawer opens/links to the same persisted draft. Evidence separates user research notes from imported facts; no fake observations or required evidence-confirmation checkbox. On mobile stack evidence with a reachable disclosure and surface missing recipient warning near identity. Explicit Save state, last-saved feedback, 409 conflict handling, asset loading retry, plain text preview, copy subject/body separately. Block internal navigation and handle beforeunload for dirty state; do not reset editor on re-render without explicit user choice. Give controls labels/focus states, keep drawer keyboard-accessible with focus restore, ensure mobile fit. Source context is escaped text/structured values; only validated http(s) URLs become external links. No demo-send or follow-up sequence controls.
- [ ] **Step 4: Verify.** Browser at 375/768/1280; keyboard through drawer/editor, accessible names, snapshot isolation, no provider request/queued send. Run E2E/typecheck/lint/format.
- [ ] **Step 5: Commit.** `feat: compose and reopen prospect email drafts`.

### Task 8: End-to-end personal-use handoff

**Files:** Modify `README.md`, `.env.example`, `.github/workflows/ci.yml`, test config and prior files only for verified regressions; create `tests/e2e/personal-workflow.spec.ts`.

**Interfaces:** Document commands `npm run db`, `npm run dev`, `npm run worker`, `npm run db:backup`, `npm run db:migrate:personal`, `npm run typecheck`, `npm run lint`, `npm run fmt:check`, `npm run test`, `npm run test:integration`, `npm run test:e2e`, `npm run build`.

- [ ] **Step 1: Write failing acceptance journey.** Synthetic 100-row mixed-country export and 10 email-less HVAC records plus CSV/JSONL, >200 rows and invalid lines; complete report -> filtered prospects -> create/edit offer/template -> save/reload/copy draft. Leave real queued send job pending with OUTBOUND_ENABLED unset and test manual reply API is blocked. Cover no account/workspace setup without destructive seed: add an idempotent minimal owner/taxonomy bootstrap command only if existing local DB lacks them.
- [ ] **Step 2: Run red journey.** `npm run test:e2e -- tests/e2e/personal-workflow.spec.ts`; identify and fix only gaps in the approved flow.
- [ ] **Step 3: Finish docs and CI.** README includes safe startup, current login limitation, backup/restore checks, additive migrations, worker/retry, supported files/limits, optional starter assets, draft-only policy and known deferred features. CI uses disposable Postgres and explicitly fails checks; no production env/provider credentials. Do not upload personal data as CI/browser artifacts. Test runs bind separate app/DB/worker instances; browser artifacts ignored locally.
- [ ] **Step 4: Final evidence.** Run all documented verification commands (fmt:check on tracked source, no broad cosmetic churn), inspect diff for secrets/unsafe DB operations, check localhost URL and worker stay running, run accessibility checks on touched screens. Use the supplied read-only files for final preview validation; do not import them into the owner's workspace without showing counts and obtaining confirmation. Report actual failures/blockers without claiming production readiness.
- [ ] **Step 5: Commit and hand off.** Explicitly stage intended source only, commit `test: verify personal import-to-draft workflow`, list tested commands and local entry URL, backup location without secrets, and the brief steps the owner can use today. Never push or deploy without separate authorization.

## Plan self-review

- Coverage: preservation/safety (1), all export formats/mapping/metadata (2), durable import and retry (3), complete interactive import/report (4), offer/template editing and approved copy (5), isolated draft persistence (6), useful editor/research context (7), acceptance/local docs (8).
- Consistency: new types exported from `lib/import/types.ts`; keep old ImportOptions local contract explicitly separate/rename its legacy type rather than colliding. New file-import functions do not silently change legacy Apify call signatures. Use one transaction executor type for new/touched write paths.
- No deployment or live provider auth is required. Preflight and Git identity are known execution gates. Each implementation task runs red/green tests and scoped commits; the integrated milestone receives final review before declaring it usable.
