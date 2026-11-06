# Supabase Auth Migration Design

## Intent

Replace the custom HMAC/email-allowlist authentication with Supabase Auth email
magic links, while preserving Outbound OS's existing workspace membership,
roles, and application service boundaries.

The goal is verified email ownership and managed session refresh/revocation;
this is not a change to prospect data, workspace data, sending behavior, or
the existing role model.

## Goals

- Sign users in through Supabase Auth email magic links.
- Store and refresh Supabase sessions using secure SSR cookies.
- Verify authenticated requests with Supabase's server-side claims validation.
- Resolve the authenticated Supabase user to the existing `public.users` row.
- Continue enforcing `OWNER`, `ADMIN`, and `MEMBER` permissions in application
  services.
- Preserve the existing `SessionUser` shape so page and API consumers change
  minimally.
- Support a controlled migration for the existing owner account.
- Keep tests for unauthenticated, authenticated, disabled, and unmapped users.

## Non-goals

- No replacement of the existing `public.users` or workspace schema.
- No direct client-side access to application tables.
- No use of `user_metadata` for authorization.
- No changes to sending, imports, prospects, or hosted data beyond the Auth
  identity mapping needed for login.
- No enabling or modifying hosted Supabase Auth settings without explicit
  approval.

## Approaches considered

### Supabase magic-link SSR sessions — selected

Use `@supabase/ssr` with request-specific server clients, a browser client for
the login flow, and Next.js middleware for token refresh. Supabase verifies
email ownership and manages the session lifecycle. Application authorization
continues to come from `public.users`.

This is selected because it preserves the current passwordless UX while
removing the custom token security and account-verification responsibilities.

### Supabase email/password

This would provide conventional credentials and password reset, but requires
additional UI, recovery flows, and password policy decisions that are not
needed for the current product.

### Browser Supabase Auth plus a custom server session

This would minimize initial wiring but duplicate session management and retain
the weaknesses identified in the authentication audit. It is rejected.

## Design

### Identity mapping

The Supabase Auth user UUID will be the application user UUID:

```text
auth.users.id = public.users.id
```

On each authenticated server request:

1. Validate the Supabase session claims.
2. Read the matching `public.users` row and workspace.
3. Require `public.users.status = ACTIVE`.
4. Return the existing `SessionUser` object.

Roles and workspace membership remain in `public.users`; they will not be
trusted from editable user metadata or unverified JWT metadata.

### Login flow

1. User enters an email on `/login`.
2. The app calls Supabase `signInWithOtp` with a redirect URL.
3. Supabase sends the magic link.
4. The callback route exchanges the code for a session.
5. The callback redirects to `/dashboard` after application-user validation.
6. Unmapped or disabled application users are signed out and shown a generic
   access-denied message.

### Server session handling

- Add a Supabase browser client and request-scoped server client.
- Add `middleware.ts` for session refresh on protected routes.
- Use `supabase.auth.getClaims()` for server-side identity verification, not
  unvalidated cookie contents.
- Replace the custom `oos_session` cookie reads with Supabase SSR cookies.
- Keep `/api/auth/me` and `/api/auth/signout` using the new auth layer.
- Keep API route wrappers responsible for application-level authorization and
  consistent error responses.

### Configuration

Add server/client configuration for:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_APP_URL`

The custom `APP_ENCRYPTION_KEY` will no longer be required for normal auth
once the migration is complete. The service-role key will not be added to the
browser or exposed through `NEXT_PUBLIC_*` variables.

### Migration and rollback

- Keep the legacy sign-in code isolated behind a temporary feature flag while
  Supabase Auth is verified.
- Do not delete the legacy code until magic-link login, callback handling,
  protected pages, API routes, sign-out, disabled users, and unmapped users are
  tested.
- Link or create the existing owner Auth identity only after explicit approval.
- Remove the legacy fallback and feature flag in the final cleanup phase.

## Verification

- Unit-test claim validation and application-user mapping.
- Test disabled and unmapped users cannot receive an application session.
- Test protected API routes reject missing/invalid Supabase sessions.
- Test magic-link callback success and failure paths with mocked Supabase Auth.
- Run typecheck, unit tests, production build, and authenticated browser checks.
- Verify no custom `oos_session` cookie is issued after cutover.

## Open implementation calls

- Use Supabase's current `@supabase/ssr` package rather than deprecated Auth
  Helpers.
- Use middleware because this project is on Next.js 15.
- Keep the existing `public.users` roles and workspace scoping unchanged.
- Perform hosted Auth configuration and owner identity linking only after
  explicit approval.
