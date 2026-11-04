# Outliaz handoff integration and UI review

Status: incorporated reference requirements; review before implementation
Date: 2026-11-04
Parent: `2026-11-04-import-to-draft-design.md`

## Authority and scope

The user supplied `/home/swiss/Desktop/outliaz-os-handoff/{AGENTS.md,README.md,PAGE_MAP.md,DESIGN_HANDOFF.md,interactions.json}` and asked to factor them into the design so we can review the UI and experience. All five and the actual `dist/index.html` have been read. The working local source supersedes the hosted preview if labels or behavior differ.

Keep the original handoff directory unchanged and runnable. Serve only its dist folder on loopback for review; do not expose its parent files or real datasets. No dependency installation is required for this prototype. It is reference software, not proof of backend completion.

This is a design/review amendment, not authorization to port every prototype page, deploy, scrape, send, migrate or import personal data. The approved first usable slice remains import -> research -> offer -> saved first-email draft. Inbox/reply/sequence simulations remain reviewable in the original prototype, outside today's functional slice. Retain the existing Next.js/Postgres codebase; no Vite/Supabase migration follows from the handoff's optional greenfield suggestions.

## Experience contract to preserve

- Paper/Bone/Ink/Hot tokens exactly as in DESIGN_HANDOFF; dark and light, 760px mobile and 1100px intermediate layout references.
- Shared shell: labelled desktop sidebar, persisted collapse to 76px accessible icon rail, visible focus, theme persistence. Mobile uses Today/Prospects/Inbox/More; More reaches Sources, Outreach, Offers, Reports, Settings. Do not copy the device-preview iframe into the real app.
- Today: action queue and real research/follow-up counts rather than decorative KPI tiles. Do not fabricate activity when starting empty.
- Sources/import: drag/drop or file chooser, readable file-ready state, explicit target country, source values beside editable field mappings, required business-name mapping, missing-email warning, country/duplicate review, progress, and reachable results/history after leaving the page.
- Recovery: committed successes remain intact; stop after current unit of work; show unprocessed remainder distinctly; correct a missing business name inline; retry only corrected or transiently failed rows; download unresolved records with reasons/source row numbers. No complete reimport required just to fix one record.
- Prospects: desktop table/mobile cards, search/stage/country filters, meaningful Research/Activity/Notes content, evidence/source, gate feedback and a clear next action. Preserve existing richer taxonomy fields in an organized classification section rather than reducing the real research gate to the sample's handful of fields.
- Offers: concise service/value/scope presentation and create/edit actions; required name; optional richer fields remain accessible without dominating the initial form.
- Outreach: selected prospect and offer, editable subject/body, research context/evidence, separate missing-contact warning, clear saved/not-sent state. One draft per real prospect, not the prototype's single global draft.
- UI state copy must distinguish Preview simulation, actual local DB persistence, queued work, committed work, research assessments and externally verified facts. A disabled action explains why. Contact checked is never relabelled independently verified.

## Differences that must be explicit

| Handoff behavior | Real-app decision |
| --- | --- |
| Explicit US pilot target; non-US/unknown excluded | Add explicit targetCountry to each import, default US and clearly shown before confirmation. Require matching normalized business country; report unknown and mismatch separately. User can select another country deliberately; future regional scope remains possible. |
| source_country separate from location | Preserve it as metadata only. Never use source_country or filename to fill unknown business country. This supersedes the earlier country fallback in the parent design/plan. |
| Skip by place ID, website or name/location | Hard dedupe normalized email and stable place ID; website/name/location can surface candidates. Canonical same-domain/different-email prospects must not be silently discarded. Show the policy difference in review copy. |
| Simplified Needs research stage and positive Possible fit qualification | Keep canonical NEW/RESEARCHED/QUALIFIED and gates from TAXONOMY.md; Possible fit does not pass the real qualification gate. A Needs research tab may be a view filter, not a new stored stage. |
| Opted out as a stage | Contactability UNSUBSCRIBED plus suppression; stage unchanged. |
| Review checkbox/contact checked permits simulated sending | Prototype simulations stay in the unchanged reference. Real drafting is not gated by qualification or a checkbox; live sending remains off server-side. |
| Browser-local save and session-only import history | Real app uses database-backed drafts/imports when that implementation is approved; label a frontend-only review as such. |
| Prototype's local parsing privacy claim | The real import sends data to the owner's local app server. Say this plainly; do not copy “No file is uploaded” onto a server-backed importer. |
| Partial failure scenario selector | Synthetic review/test fixture only, never injected failures in real personal imports. |
| Report counts/sign-in/scheduler demos | Preserve reference for experience review; do not imply production integrations or auth are present. No fake reports in the real app. |

Country/language/timezone remain distinct concepts. Preserve source language/timezone as metadata when available; never invent them from country. New first-class multilingual/scheduling fields belong to a separately agreed scope.

## Review sequence

### Icon requirement (user feedback)

Use one consistent Lucide outline icon set, already available in the application, composed with shadcn controls. The prototype already has navigation SVGs; carry their meaning into the real UI and extend icons to functional actions rather than adding decorative artwork.

User refinement: **plain, minimalist icons**. Use a consistent 1.5px stroke, monochrome currentColor, no fills, backgrounds, containers, decorative badges or animation. Default to icons for navigation and compact utilities (copy, theme, sidebar, overflow); ordinary labelled buttons such as Save draft, Import file and Retry record remain text-only unless an icon materially aids recognition. The mappings below are an available vocabulary, not a requirement to show every icon. Keep status icons only where they clarify a warning/error/success, always with text. This restraint takes precedence over the earlier broader icon coverage.

- Navigation: CalendarDays (Today), UsersRound (Prospects), Database (Sources), Send (Outreach destination only), Inbox, Tag (Offers), ChartNoAxesCombined (Reports), Settings, Ellipsis (More).
- File workflow: Upload, FileJson/FileSpreadsheet, Columns3 (mapping), CircleAlert (issues), CircleCheck (complete), RotateCcw (retry), Download, Square (stop).
- Research/drafts: Search, NotebookPen, ExternalLink, Plus, Pencil, Save, Copy, ChevronLeft/ChevronRight, PanelLeftClose/PanelLeftOpen and Sun/Moon.
- Keep visible action labels: Import file, Save draft, Copy message, Retry record. Save draft uses Save, never Send; a Send icon is not permission to deliver email.
- Use 16–18px nav/inline icons and approximately 20px standalone affordances, consistent outline stroke, semantic token colors, no tinted icon tiles or emoji. shadcn Button owns icon dimensions via its variants; use data-icon placement rather than per-instance sizing overrides.
- Labelled icons are aria-hidden. Icon-only controls require accessible names, keyboard focus and tooltips, especially in the collapsed rail; touch targets are at least 44px. Status icon + words conveys meaning independently of color. Loading spinner accompanies unchanged action label and disabled control.
- Add no icons to every heading, metric or offer card merely to fill space. Icons identify a destination, action, file type or actionable state.

1. **Shell and orientation:** original desktop expanded/collapsed, both themes, mobile navigation and More. Does it feel comfortable for a daily working session?
2. **Import and recovery:** sample success, country mismatch/unknown, missing email/name, remapping, partial failure, stop/return/correction/retry. Can the user explain what was added and what still needs action?
3. **Research to draft:** prospect context and evidence -> relevant offer -> personalized editable message. Can missing research be distinguished from missing recipient details, and can a draft be saved without sending?
4. **Touched-screen frontend port:** after review approval, move one connected page/state at a time into the existing app with shadcn semantics, preserving the exact brand and purposeful layout. Record before/after differences; no all-at-once rewrite.
5. **Functional implementation:** execute only the approved persistence/import slice after preflight, backup and isolated test setup. Prototype acceptance counts are synthetic fixtures, never expectations for the supplied private exports.

No mockup is functional acceptance. The original handoff's reported checks are external claims, not checks run by this agent. Screenshots, keyboard behavior, real font loading, full a11y and mobile rendering still require direct verification. IBM Plex Sans binary and original sculpted logo are absent: obtain a legitimate font for implementation and retain the typographic wordmark until the actual SVG is supplied.

## Review artifact and progress

Maintain `BUILD_PROGRESS.md` with Done/Next/Blocked and actual verification evidence. During this review, documentation and the unchanged prototype are the only outputs. Backend/environment/Git identity blockers do not prevent discussing the runnable reference, but they do block the later Ralph implementation gate as documented in the plan.
