# Outliaz OS

Personal prospect research and outreach workspace. The current development slice
updates the shared UI shell; it does not complete live imports or email drafting.

## UI review

```bash
npm ci
NEXT_DIST_DIR=.next-ui npm exec next dev -- --hostname 127.0.0.1 --port 3001
```

Open http://127.0.0.1:3001/ui-review. This page uses synthetic, empty workspace
data and the same shell as the application. It makes no database requests.
Navigation opens existing application routes and may require local sign-in.

The original design source remains unchanged at
`/home/swiss/Desktop/outliaz-os-handoff/dist/index.html` (not bundled into the app).
See DESIGN.md for tokens and docs/superpowers/specs for agreed behavior.

## Verification

```bash
npm run typecheck
npm run fmt:check
npm test -- --workers=1
NEXT_DIST_DIR=.next-ui-build npm run build
NEXT_DIST_DIR=.next-ui-build npm exec next start -- --hostname 127.0.0.1 --port 3002
UI_TEST_URL=http://127.0.0.1:3002 npm test -- --workers=1
```

Tests use the synthetic review page; no real workspace is reset or seeded.
Playwright uses /usr/bin/chromium when installed; otherwise install its browser
with `npx playwright install chromium`. You can set
PLAYWRIGHT_CHROMIUM_EXECUTABLE to another compatible Chromium binary.

## Safety and current limitations

- Keep the app bound to loopback. Existing email-only demo sign-in is not safe
  for public deployment. Do not expose this app through a public tunnel.
- **Do not run db:seed against personal data. It truncates application tables.**
- Do not run db:push/reset, imports, sending jobs or provider verification merely
  to review the interface. Backups and isolated test DB setup are prerequisites
  to the later persistence milestone.
- Existing backend/provider and sending behavior has not been hardened by this
  UI slice. A UI preview label is not a server-enforced outbound safeguard.
- The /outreach route explicitly states that the draft editor is pending; no
  dummy send/draft persistence is presented as working functionality.
- npm reports 8 dependency advisories (5 moderate, 3 high) in the existing tree.
  They need a separate dependency review; no automatic force upgrades were run.

Private env files, local DB files, dependencies, build output, browser artifacts
and private source datasets are ignored. Never commit them.
