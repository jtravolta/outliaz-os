# Supabase Auth cutover runbook

This project uses Supabase Auth sessions and resolves authorization from the
matching active `public.users` row. The `public.users.id` must equal the Auth
user UUID; role, status, email, and workspace remain application-database
values. The legacy database email helper is disabled when
`SUPABASE_AUTH_CUTOVER=true` and never issues the `oos_session` cookie.

## Hosted setup (approval required)

Do not perform these steps without explicit approval from the workspace owner.

1. In Supabase Dashboard → Authentication → Providers, enable Email and keep
   email confirmation enabled. Configure the production SMTP sender before
   sending an invite.
2. In Authentication → URL Configuration, set the production Site URL and add
   the exact production `/auth/callback` URL. Keep the local callback URL only
   in non-production projects.
3. Keep anonymous sign-ins and automatic user creation outside the approved
   invite flow disabled. Never expose a service-role key to the browser.
4. Create or invite the owner in Auth, then record the resulting Auth user UUID
   from the dashboard. Do not guess or derive this UUID from the email address.
5. In a reviewed, backed-up database change, link the existing owner row to
   that UUID (or create the application row with that UUID), preserving its
   existing workspace, `OWNER` role, and `ACTIVE` status. Verify there is one
   matching row before the owner signs in. This data migration is intentionally
   not executed by this task.
6. Set the production public URL and publishable key, leave
   `SUPABASE_AUTH_CUTOVER=true`, and verify the magic-link callback in staging
   before enabling production traffic.

## Local verification checklist

- Missing public Supabase variables fail Auth configuration validation;
  protected requests redirect to `/login` rather than using a fallback.
- A valid Auth claim without an active mapped application user is rejected.
- Role and workspace values come only from the application row.
- Response cookies are Supabase SSR cookies with secure production attributes;
  no custom `oos_session` cookie is issued.
- Hosted dashboard configuration, owner linking, imports, seeds, and sends are
  outside this runbook's execution scope.
