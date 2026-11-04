# Outbound OS — light build (one page)

A single self-contained HTML file that makes the BUILD-PLAN's core loop real enough to click
through. No build step, no backend, no dependencies loaded from the network.

Open `index.html` directly in a browser, or serve the folder:

```bash
cd outbound-os/light && python3 -m http.server 8123
# http://127.0.0.1:8123
```

## What is implemented

- **Prospect list** — 14 seeded prospects, server-style filters (search, industry, fit, priority,
  gate readiness) and the 11-stage pipeline strip that doubles as a stage filter.
- **Full taxonomy on the record** — industry → business type, size (derived from employee count),
  geography/market, opportunity and service multi-selects, fit, priority, contact, tags.
- **Gates, enforced** — live research / qualification / enrollment checklists. Moving a prospect
  into `RESEARCHED` or `QUALIFIED` is blocked exactly as the plan specifies, with the missing
  requirements named.
- **Transition matrix** — only legal next stages are offered; `LOST` and `DISQUALIFIED` demand a
  reason (≥3 chars); the drawer logs every change to a timeline.
- **Invariants** — setting priority to `DISQUALIFIED` forces the stage and cancels sends; `UNKNOWN`
  opportunity is exclusive to `NEW`; contactability is a separate axis from stage.
- **Suggest services** — maps opportunities to potential services per `TAXONOMY.md`.
- **Add prospect** — dependent industry → type select, opportunity/service chip toggles, size
  derivation, validation.
- **Export CSV** of the current filtered set; import is not included.
- **Persistence** — `localStorage`, so edits survive a reload. `⟲` restores demo data.
- Light/dark theme, responsive down to ~375px.

## What is deliberately absent

Everything that needs a server: Apify sourcing, sequence sending, IMAP reply detection, auth and
roles, async import jobs, audit persistence, multi-user concurrency. Those are specified in
`BUILD-PLAN.md` and `ONE-SHOT-BUILD-PROMPT.md`; this file is the UI/business-rule sketch, not a
replacement for the build.
