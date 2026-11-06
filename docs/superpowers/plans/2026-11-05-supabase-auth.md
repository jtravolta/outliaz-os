# Supabase Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended) to implement this plan task-by-task.

**Goal:** Replace the custom email-allowlist/HMAC session with Supabase Auth email magic links while preserving existing workspace and role authorization.

**Architecture:** Use `@supabase/ssr` request-scoped server clients, a browser client for OTP initiation, and Next.js 15 `middleware.ts` for cookie refresh. The authenticated Supabase UUID maps to `public.users.id`; application role and workspace data continue to come from the database.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, `@supabase/supabase-js`, `@supabase/ssr`, Supabase Auth, Prisma/Drizzle PostgreSQL access, Node test runner, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-05-supabase-auth-design.md`

## Global Constraints

- Use the current `@supabase/ssr` package, not deprecated Auth Helpers.
- Use Next.js 15 `middleware.ts` for Supabase session refresh.
- Never use editable `user_metadata` for authorization.
- Keep roles and workspace membership in `public.users`.
- Do not expose a service-role or secret key to browser code.
- Do not modify hosted Auth settings or link the hosted owner until explicit approval.
- Keep sending disabled and preserve the existing application routes and API contracts.
- Do not remove the legacy auth path until the migration verification passes.

## Review Focus

- Missing or malformed Supabase claims must become an unauthenticated request, covered in Task 2.
- A valid Auth user with no `public.users` row must not access the app, covered in Task 2.
- A disabled `public.users` row must be rejected even when the Supabase session is valid, covered in Task 2.
- Magic-link callback errors and missing codes must not create an application session, covered in Task 3.
- Session refresh must preserve cookies and prevent cache leakage, covered in Task 4.

---

### Task 1: Add Supabase SSR client infrastructure

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `lib/supabase/browser.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/types.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces `createBrowserSupabaseClient()` for client components.
- Produces `createServerSupabaseClient()` for route handlers and server components.
- Produces a typed `SupabaseClaims`/application-user boundary without exposing service credentials.

- [ ] **Step 1: Write failing infrastructure tests** asserting the browser client requires the public URL/key and the server client reads request cookies through the SSR adapter.
- [ ] **Step 2: Run `npm run test:unit` and confirm the new tests fail because the clients do not exist.**
- [ ] **Step 3: Install pinned `@supabase/supabase-js` and `@supabase/ssr` versions and implement the browser/server client factories.** Use only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- [ ] **Step 4: Add the corresponding variables and callback URL guidance to `.env.example`.** Do not add secrets.
- [ ] **Step 5: Run the focused tests, `npm run typecheck`, and confirm they pass.**
- [ ] **Step 6: Commit with `feat: add Supabase SSR auth clients`.**

### Task 2: Replace application session resolution with verified Supabase claims

**Files:**
- Modify: `lib/auth/session.ts`
- Modify: `lib/api.ts`
- Create: `tests/unit/supabase-session.test.ts`
- Preserve: `tests/unit/auth-session-prisma.test.ts` until the migration is complete.

**Interfaces:**
- `getSession(): Promise<SessionUser | null>` remains the existing application boundary.
- Add `getSupabaseSessionUser(): Promise<SessionUser | null>` or an equivalent internal resolver that validates claims, then reads `public.users` and its workspace.
- `requireSession()` continues to throw `UNAUTHORIZED` when resolution fails.

- [ ] **Step 1: Write failing tests** for valid active mapping, malformed/absent claims, unmapped Auth user, disabled application user, and role/workspace mapping.
- [ ] **Step 2: Run the focused tests and confirm failure.**
- [ ] **Step 3: Implement claim verification using `supabase.auth.getClaims()` and a database lookup by the verified Auth user ID.** Do not trust cookie JSON or user metadata.
- [ ] **Step 4: Keep `SessionUser` unchanged so existing pages/services remain compatible.**
- [ ] **Step 5: Update `lib/api.ts` to use the new resolver for protected routes.**
- [ ] **Step 6: Run focused auth tests, existing unit tests, and typecheck.**
- [ ] **Step 7: Commit with `feat: resolve application sessions through Supabase Auth`.**

### Task 3: Implement magic-link sign-in and callback

**Files:**
- Modify: `app/login/page.tsx`
- Modify: `app/api/auth/signin/route.ts`
- Modify: `app/api/auth/signout/route.ts`
- Create: `app/auth/callback/route.ts`
- Modify: `app/api/auth/me/route.ts`
- Create: `tests/unit/supabase-auth-routes.test.ts`

**Interfaces:**
- `POST /api/auth/signin` accepts `{ email: string }`, starts Supabase OTP, and returns a generic success response.
- `GET /auth/callback?code=...` exchanges the code, validates the application user, and redirects to `/dashboard` or `/login?error=access_denied`.
- `POST /api/auth/signout` calls Supabase sign-out and clears the SSR session cookies.

- [ ] **Step 1: Write failing route tests** for normalized email submission, generic success behavior, callback success, missing code, exchange failure, unmapped user, and disabled user.
- [ ] **Step 2: Run focused route tests and confirm failure.**
- [ ] **Step 3: Implement `signInWithOtp` with a callback URL derived from the configured application URL.** Avoid revealing whether an email is registered.
- [ ] **Step 4: Implement the callback code exchange and application-user validation.** Ensure failure paths clear the Supabase session before redirecting.
- [ ] **Step 5: Update the login UI to show “Check your email” rather than claiming immediate sign-in.** Preserve the existing visual style.
- [ ] **Step 6: Implement Supabase sign-out and update `/api/auth/me` to use the new resolver.**
- [ ] **Step 7: Run focused tests, typecheck, and verify no `oos_session` cookie is issued by the new routes.**
- [ ] **Step 8: Commit with `feat: add Supabase magic-link authentication`.**

### Task 4: Add Next.js session-refresh middleware and protected-route integration

**Files:**
- Create: `middleware.ts`
- Modify: `app/(app)/layout.tsx`
- Modify: `app/login/page.tsx`
- Create: `tests/unit/supabase-middleware.test.ts`
- Modify: `tests/e2e/shell.spec.ts` or add an auth-focused Playwright spec.

**Interfaces:**
- Middleware refreshes Supabase cookies on requests that need auth and returns the response containing refreshed cookies/cache headers.
- Protected app layout redirects unauthenticated users to `/login`.
- Public auth callback and static assets remain reachable.

- [ ] **Step 1: Write failing middleware tests** for cookie refresh propagation, public paths, protected paths, and invalid sessions.
- [ ] **Step 2: Run focused tests and confirm failure.**
- [ ] **Step 3: Implement Next.js 15 middleware using the SSR server client and `getClaims()`.** Preserve Supabase cache-control headers when returning a replacement response.
- [ ] **Step 4: Ensure the app layout resolves the application user and redirects when the Auth identity is unmapped or disabled.**
- [ ] **Step 5: Add browser coverage for login page, callback boundary, protected-page redirect, and sign-out behavior using mocked Supabase Auth where hosted Auth is unavailable.**
- [ ] **Step 6: Run tests and typecheck.**
- [ ] **Step 7: Commit with `feat: refresh Supabase sessions in middleware`.**

### Task 5: Controlled migration, configuration hardening, and cleanup

**Files:**
- Modify: `lib/auth/session.ts`
- Modify: `.env.example`
- Modify: `BUILD_PROGRESS.md`
- Modify: relevant tests and documentation.

**Interfaces:**
- Production configuration fails closed if Supabase Auth variables are missing.
- Legacy HMAC auth is unavailable after the cutover flag is enabled.
- Existing role checks and workspace scoping remain unchanged.

- [ ] **Step 1: Add failing configuration tests** for missing public Supabase variables and disabled legacy fallback in cutover mode.
- [ ] **Step 2: Implement fail-closed configuration validation and remove the insecure HMAC fallback from the active path.**
- [ ] **Step 3: Verify the existing hosted owner migration procedure without executing it:** document the required Auth user UUID/linking step and required dashboard settings.
- [ ] **Step 4: Run `npm run test:unit`, `npm run typecheck`, `npm run ui:build`, and authenticated browser checks.**
- [ ] **Step 5: Inspect response headers/cookies to confirm secure Supabase cookies and no custom `oos_session`.**
- [ ] **Step 6: Update `BUILD_PROGRESS.md` with evidence and commit with `chore: complete Supabase Auth cutover`.**

## Final verification

Run:

```bash
npm run test:unit
npm run typecheck
npm run ui:build
git diff --check
```

Before any hosted migration, verify the local flow end-to-end and obtain explicit approval for Supabase Auth dashboard configuration and linking the existing owner account.
