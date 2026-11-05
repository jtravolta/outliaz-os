-- Baseline for the empty Supabase target.
-- Applied from the verified database handoff on 2026-11-05.
-- Do not re-run against a database where these objects already exist.

-- Outbound OS: initial schema. Apply once through migration tooling.
-- Auth.js identities, server-only SQL access; no Supabase Auth dependency.
SET LOCAL search_path = public, pg_catalog;

CREATE TYPE public.industry AS ENUM ('PROFESSIONAL_SERVICES', 'HEALTHCARE', 'HOME_SERVICES', 'CONSTRUCTION_TRADES', 'PROPERTY_REAL_ESTATE', 'HOSPITALITY_FOOD', 'BEAUTY_WELLNESS', 'RETAIL_ECOMMERCE', 'AUTOMOTIVE', 'EDUCATION_TRAINING', 'TECHNOLOGY', 'FINANCE_INSURANCE', 'CREATIVE_MEDIA', 'TRAVEL_TOURISM', 'AGRICULTURE', 'MANUFACTURING', 'OTHER');

CREATE TYPE public.company_size AS ENUM ('SOLO', 'MICRO', 'SMALL', 'SMALL_MEDIUM', 'MEDIUM', 'LARGE', 'UNKNOWN');

CREATE TYPE public.opportunity AS ENUM ('NO_WEBSITE', 'OUTDATED_WEBSITE', 'POOR_MOBILE_EXPERIENCE', 'POOR_USER_EXPERIENCE', 'WEAK_BRANDING', 'WEAK_CONVERSION', 'NO_LEAD_CAPTURE', 'NO_ONLINE_BOOKING', 'ECOMMERCE_OPPORTUNITY', 'NEEDS_AUTOMATION', 'NEEDS_WEB_APPLICATION', 'WEBSITE_PERFORMANCE', 'SEO_DISCOVERABILITY', 'UNKNOWN');

CREATE TYPE public.potential_service AS ENUM ('WEBSITE_DESIGN', 'WEBSITE_REDESIGN', 'WEBSITE_DEVELOPMENT', 'LANDING_PAGE', 'ECOMMERCE', 'BRAND_IDENTITY', 'BRAND_REFRESH', 'UI_UX_DESIGN', 'WEB_APPLICATION', 'BOOKING_SYSTEM', 'LEAD_GENERATION_SYSTEM', 'BUSINESS_AUTOMATION', 'WEBSITE_OPTIMISATION', 'ONGOING_SUPPORT', 'OTHER');

CREATE TYPE public.fit AS ENUM ('STRONG', 'GOOD', 'POSSIBLE', 'POOR', 'UNKNOWN');

CREATE TYPE public.priority AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'DISQUALIFIED');

CREATE TYPE public.contact_role AS ENUM ('OWNER', 'FOUNDER', 'MANAGING_DIRECTOR', 'CEO', 'MARKETING_DIRECTOR', 'MARKETING_MANAGER', 'OPERATIONS_DIRECTOR', 'OPERATIONS_MANAGER', 'GENERAL_MANAGER', 'OTHER_DECISION_MAKER');

CREATE TYPE public.contact_quality AS ENUM ('VERIFIED', 'UNVERIFIED', 'RISKY', 'BOUNCED', 'UNKNOWN');

CREATE TYPE public.pipeline_stage AS ENUM ('NEW', 'RESEARCHED', 'QUALIFIED', 'CONTACTED', 'FOLLOW_UP', 'REPLIED', 'MEETING', 'PROPOSAL', 'WON', 'LOST', 'DISQUALIFIED');

CREATE TYPE public.contactability AS ENUM ('OK', 'BOUNCED', 'UNSUBSCRIBED', 'DO_NOT_CONTACT');

CREATE TYPE public.user_role AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

CREATE TYPE public.user_status AS ENUM ('ACTIVE', 'INVITED', 'DISABLED');

CREATE TYPE public.integration_kind AS ENUM ('APIFY', 'RESEND', 'IMAP');

CREATE TYPE public.source_schedule AS ENUM ('OFF', 'DAILY', 'WEEKLY');

CREATE TYPE public.run_status AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'IMPORTED');

CREATE TYPE public.import_status AS ENUM ('PREVIEW', 'QUEUED', 'RUNNING', 'DONE', 'FAILED', 'CANCELLED');

CREATE TYPE public.sequence_status AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');

CREATE TYPE public.enrollment_status AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'STOPPED', 'FAILED');

CREATE TYPE public.message_status AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'BOUNCED', 'COMPLAINED', 'FAILED', 'CANCELLED');

CREATE TYPE public.reply_outcome AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE', 'NOT_INTERESTED', 'OOO');

CREATE TYPE public.suppression_reason AS ENUM ('UNSUBSCRIBED', 'HARD_BOUNCE', 'COMPLAINT', 'MANUAL', 'INVALID');

CREATE TYPE public.job_status AS ENUM ('PENDING', 'CLAIMED', 'DONE', 'DEAD', 'CANCELLED');

CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 200),
timezone text NOT NULL DEFAULT 'Europe/Zurich',
send_window_start time NOT NULL DEFAULT '09:00', send_window_end time NOT NULL DEFAULT '17:00',
send_weekdays smallint[] NOT NULL DEFAULT ARRAY[1,2,3,4,5]::smallint[],
daily_send_cap integer NOT NULL DEFAULT 50 CHECK(daily_send_cap>=0),
hourly_send_cap integer NOT NULL DEFAULT 60 CHECK(hourly_send_cap>=0),
track_opens boolean NOT NULL DEFAULT false, track_clicks boolean NOT NULL DEFAULT false,
unsubscribe_footer text NOT NULL DEFAULT 'Unsubscribe', setup_completed_at timestamptz,
CHECK(send_window_end > send_window_start),
CHECK(cardinality(send_weekdays)>0 AND send_weekdays <@ ARRAY[1,2,3,4,5,6,7]::smallint[])
);

CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  email text NOT NULL UNIQUE CHECK(email=lower(btrim(email)) AND email<>''), name text,
email_verified timestamptz, avatar_url text, role public.user_role NOT NULL DEFAULT 'MEMBER',
status public.user_status NOT NULL DEFAULT 'INVITED', session_version integer NOT NULL DEFAULT 1 CHECK(session_version>0),
  UNIQUE(workspace_id, id)
);

CREATE UNIQUE INDEX one_workspace_owner ON public.users(workspace_id) WHERE role='OWNER';

CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL, type text NOT NULL, provider text NOT NULL, provider_account_id text NOT NULL,
refresh_token text, access_token text, expires_at bigint, token_type text, scope text, id_token text, session_state text,
UNIQUE(provider,provider_account_id),
  UNIQUE(workspace_id, id)
);

ALTER TABLE public.accounts ADD FOREIGN KEY (workspace_id, user_id) REFERENCES public.users(workspace_id, id);

CREATE TABLE public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL, session_token text NOT NULL UNIQUE, expires timestamptz NOT NULL,
  UNIQUE(workspace_id, id)
);

ALTER TABLE public.sessions ADD FOREIGN KEY (workspace_id, user_id) REFERENCES public.users(workspace_id, id);

CREATE TABLE public.verification_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  identifier text NOT NULL, token text NOT NULL UNIQUE, expires timestamptz NOT NULL, UNIQUE(identifier,token)
);

CREATE TABLE public.industries (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  industry_slug public.industry NOT NULL, label text NOT NULL CHECK(length(btrim(label))>0), PRIMARY KEY(workspace_id,industry_slug)
);

CREATE TABLE public.business_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  industry_slug public.industry NOT NULL, label text NOT NULL CHECK(length(btrim(label))>0),
slug text NOT NULL CHECK(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), is_system boolean NOT NULL DEFAULT false, archived_at timestamptz,
UNIQUE(workspace_id,industry_slug,slug), UNIQUE(workspace_id,id,industry_slug),
FOREIGN KEY(workspace_id,industry_slug) REFERENCES public.industries(workspace_id,industry_slug),
  UNIQUE(workspace_id, id)
);

CREATE TABLE public.integration_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  kind public.integration_kind NOT NULL, label text, config jsonb NOT NULL DEFAULT '{}',
secret_ciphertext bytea NOT NULL, secret_iv bytea NOT NULL CHECK(octet_length(secret_iv)=12),
secret_tag bytea NOT NULL CHECK(octet_length(secret_tag)=16), encryption_key_version integer NOT NULL DEFAULT 1,
verified_at timestamptz, last_error text, UNIQUE(workspace_id,kind),
  UNIQUE(workspace_id, id)
);

CREATE TABLE public.sending_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  domain_normalized text NOT NULL CHECK(domain_normalized=lower(btrim(domain_normalized))),
provider_domain_id text, from_name text, from_email text, reply_to_email text,
verified_at timestamptz, revoked_at timestamptz, UNIQUE(workspace_id,domain_normalized),
  UNIQUE(workspace_id, id)
);

CREATE TABLE public.qualification_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL, description text, match text NOT NULL DEFAULT 'ALL' CHECK(match IN ('ALL','ANY')),
conditions jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(conditions)='array'),
revision integer NOT NULL DEFAULT 1 CHECK(revision>0), is_active boolean NOT NULL DEFAULT true, created_by uuid,
  UNIQUE(workspace_id, id)
);

ALTER TABLE public.qualification_rules ADD FOREIGN KEY (workspace_id, created_by) REFERENCES public.users(workspace_id, id);

CREATE TABLE public.lead_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL, description text, actor_id text NOT NULL, actor_name text,
input_defaults jsonb NOT NULL DEFAULT '{}', mapping jsonb NOT NULL DEFAULT '{}',
default_industry public.industry, default_market text, default_opportunity public.opportunity,
qualification_rule_id uuid, schedule public.source_schedule NOT NULL DEFAULT 'OFF',
schedule_hour time, schedule_weekday smallint CHECK(schedule_weekday BETWEEN 1 AND 7), next_run_at timestamptz,
verify_mx boolean NOT NULL DEFAULT false, allow_role_addresses boolean NOT NULL DEFAULT false,
archived_at timestamptz, last_run_at timestamptz, created_by uuid,
CHECK(schedule='OFF' OR schedule_hour IS NOT NULL), CHECK(schedule<>'WEEKLY' OR schedule_weekday IS NOT NULL),
  UNIQUE(workspace_id, id)
);

ALTER TABLE public.lead_sources ADD FOREIGN KEY (workspace_id, created_by) REFERENCES public.users(workspace_id, id);

ALTER TABLE public.lead_sources ADD FOREIGN KEY (workspace_id, qualification_rule_id) REFERENCES public.qualification_rules(workspace_id, id);

ALTER TABLE public.lead_sources ADD FOREIGN KEY (workspace_id, default_industry) REFERENCES public.industries(workspace_id, industry_slug);

CREATE TABLE public.source_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  source_id uuid NOT NULL, apify_run_id text UNIQUE, apify_dataset_id text,
status public.run_status NOT NULL DEFAULT 'QUEUED', input jsonb NOT NULL DEFAULT '{}',
started_at timestamptz, finished_at timestamptz, import_cursor bigint NOT NULL DEFAULT 0 CHECK(import_cursor>=0),
items_fetched integer NOT NULL DEFAULT 0 CHECK(items_fetched>=0), items_imported integer NOT NULL DEFAULT 0 CHECK(items_imported>=0),
items_duplicate integer NOT NULL DEFAULT 0 CHECK(items_duplicate>=0), items_invalid integer NOT NULL DEFAULT 0 CHECK(items_invalid>=0),
items_qualified integer NOT NULL DEFAULT 0 CHECK(items_qualified>=0), items_disqualified integer NOT NULL DEFAULT 0 CHECK(items_disqualified>=0),
error jsonb, sample_items jsonb, UNIQUE(workspace_id,id,source_id),
  UNIQUE(workspace_id, id)
);

ALTER TABLE public.source_runs ADD FOREIGN KEY (workspace_id, source_id) REFERENCES public.lead_sources(workspace_id, id);

CREATE TABLE public.import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL DEFAULT 'CSV' CHECK(kind='CSV'), file_name text, mapping jsonb NOT NULL DEFAULT '{}',
status public.import_status NOT NULL DEFAULT 'PREVIEW', rows_total integer NOT NULL DEFAULT 0 CHECK(rows_total BETWEEN 0 AND 20000),
rows_processed integer NOT NULL DEFAULT 0 CHECK(rows_processed>=0), rows_imported integer NOT NULL DEFAULT 0 CHECK(rows_imported>=0),
rows_invalid integer NOT NULL DEFAULT 0 CHECK(rows_invalid>=0), rows_duplicate integer NOT NULL DEFAULT 0 CHECK(rows_duplicate>=0),
rows_suppressed integer NOT NULL DEFAULT 0 CHECK(rows_suppressed>=0), error_report jsonb NOT NULL DEFAULT '[]',
created_by uuid, CHECK(rows_processed<=rows_total),
  UNIQUE(workspace_id, id)
);

ALTER TABLE public.import_batches ADD FOREIGN KEY (workspace_id, created_by) REFERENCES public.users(workspace_id, id);

CREATE TABLE public.prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  business_name text NOT NULL CHECK(length(btrim(business_name)) BETWEEN 1 AND 300), website text, domain_normalized text,
industry_slug public.industry, business_type_id uuid, company_size public.company_size NOT NULL DEFAULT 'UNKNOWN',
company_size_manual boolean NOT NULL DEFAULT false, employee_count integer CHECK(employee_count>=1), employee_range text,
city text, region text, country_code text CHECK(country_code ~ '^[A-Z]{2}$'), market text,
fit public.fit NOT NULL DEFAULT 'UNKNOWN', priority public.priority NOT NULL DEFAULT 'MEDIUM',
stage public.pipeline_stage NOT NULL DEFAULT 'NEW', contactability public.contactability NOT NULL DEFAULT 'OK',
contact_name text, contact_first_name text, contact_last_name text, contact_role public.contact_role,
contact_email text, contact_email_normalized text GENERATED ALWAYS AS (nullif(lower(btrim(contact_email)),'')) STORED,
contact_phone text, contact_linkedin text, contact_quality public.contact_quality NOT NULL DEFAULT 'UNKNOWN',
next_action text, follow_up_date date, closed_reason text, gate_override_reason text,
gate_override_by uuid, gate_override_at timestamptz, qualification_rule_id uuid, qualification_revision integer,
source_id uuid, source_run_id uuid, import_batch_id uuid, owner_user_id uuid,
is_duplicate_candidate boolean NOT NULL DEFAULT false, custom_fields jsonb NOT NULL DEFAULT '{}',
last_contacted_at timestamptz, last_reply_at timestamptz, deleted_at timestamptz,
CHECK(priority<>'DISQUALIFIED' OR stage='DISQUALIFIED'),
CHECK(stage NOT IN ('LOST','DISQUALIFIED') OR length(btrim(coalesce(closed_reason,'')))>=3),
CHECK(gate_override_reason IS NULL OR (length(btrim(gate_override_reason))>=10 AND gate_override_by IS NOT NULL AND gate_override_at IS NOT NULL)),
CHECK(business_type_id IS NULL OR industry_slug IS NOT NULL),
CHECK(source_run_id IS NULL OR source_id IS NOT NULL),
FOREIGN KEY(workspace_id,business_type_id,industry_slug) REFERENCES public.business_types(workspace_id,id,industry_slug),
FOREIGN KEY(workspace_id,source_run_id,source_id) REFERENCES public.source_runs(workspace_id,id,source_id),
  UNIQUE(workspace_id, id)
);

ALTER TABLE public.prospects ADD FOREIGN KEY (workspace_id, industry_slug) REFERENCES public.industries(workspace_id, industry_slug);

ALTER TABLE public.prospects ADD FOREIGN KEY (workspace_id, source_id) REFERENCES public.lead_sources(workspace_id, id);

ALTER TABLE public.prospects ADD FOREIGN KEY (workspace_id, import_batch_id) REFERENCES public.import_batches(workspace_id, id);

ALTER TABLE public.prospects ADD FOREIGN KEY (workspace_id, owner_user_id) REFERENCES public.users(workspace_id, id);

ALTER TABLE public.prospects ADD FOREIGN KEY (workspace_id, gate_override_by) REFERENCES public.users(workspace_id, id);

ALTER TABLE public.prospects ADD FOREIGN KEY (workspace_id, qualification_rule_id) REFERENCES public.qualification_rules(workspace_id, id);

CREATE UNIQUE INDEX prospect_email_dedupe ON public.prospects(workspace_id,contact_email_normalized) WHERE contact_email_normalized IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX ON public.prospects (workspace_id,stage,created_at DESC) WHERE deleted_at IS NULL;

CREATE INDEX ON public.prospects (workspace_id,industry_slug);

CREATE INDEX ON public.prospects (workspace_id,follow_up_date) WHERE deleted_at IS NULL;

CREATE INDEX ON public.prospects (workspace_id,domain_normalized);

CREATE INDEX ON public.prospects (workspace_id,source_run_id);

CREATE INDEX ON public.prospects (workspace_id,owner_user_id);

CREATE INDEX ON public.prospects USING gin(custom_fields);

CREATE TABLE public.prospect_opportunities (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  prospect_id uuid NOT NULL, opportunity public.opportunity NOT NULL, PRIMARY KEY(workspace_id,prospect_id,opportunity)
);

ALTER TABLE public.prospect_opportunities ADD FOREIGN KEY (workspace_id, prospect_id) REFERENCES public.prospects(workspace_id, id);

CREATE TABLE public.prospect_services (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  prospect_id uuid NOT NULL, service public.potential_service NOT NULL, PRIMARY KEY(workspace_id,prospect_id,service)
);

ALTER TABLE public.prospect_services ADD FOREIGN KEY (workspace_id, prospect_id) REFERENCES public.prospects(workspace_id, id);

CREATE TABLE public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  label text NOT NULL, slug text NOT NULL CHECK(slug=lower(btrim(slug)) AND slug<>''), UNIQUE(workspace_id,slug),
  UNIQUE(workspace_id, id)
);

CREATE TABLE public.prospect_tags (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  prospect_id uuid NOT NULL, tag_id uuid NOT NULL, PRIMARY KEY(workspace_id,prospect_id,tag_id)
);

ALTER TABLE public.prospect_tags ADD FOREIGN KEY (workspace_id, prospect_id) REFERENCES public.prospects(workspace_id, id);

ALTER TABLE public.prospect_tags ADD FOREIGN KEY (workspace_id, tag_id) REFERENCES public.tags(workspace_id, id);

CREATE INDEX ON public.prospect_tags (workspace_id,tag_id);

CREATE TABLE public.prospect_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  prospect_id uuid NOT NULL, body_md text NOT NULL, author_user_id uuid NOT NULL,
  UNIQUE(workspace_id, id)
);

ALTER TABLE public.prospect_notes ADD FOREIGN KEY (workspace_id, prospect_id) REFERENCES public.prospects(workspace_id, id);

ALTER TABLE public.prospect_notes ADD FOREIGN KEY (workspace_id, author_user_id) REFERENCES public.users(workspace_id, id);

CREATE TABLE public.prospect_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  prospect_id uuid NOT NULL, type text NOT NULL, payload jsonb NOT NULL DEFAULT '{}', actor_user_id uuid,
  UNIQUE(workspace_id, id)
);

ALTER TABLE public.prospect_events ADD FOREIGN KEY (workspace_id, prospect_id) REFERENCES public.prospects(workspace_id, id);

ALTER TABLE public.prospect_events ADD FOREIGN KEY (workspace_id, actor_user_id) REFERENCES public.users(workspace_id, id);

CREATE TABLE public.deleted_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  email_normalized text NOT NULL CHECK(email_normalized=lower(btrim(email_normalized)) AND email_normalized<>''), deleted_at timestamptz NOT NULL DEFAULT now(), UNIQUE(workspace_id,email_normalized),
  UNIQUE(workspace_id, id)
);

CREATE TABLE public.suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  email_normalized text NOT NULL CHECK(email_normalized=lower(btrim(email_normalized)) AND email_normalized<>''), reason public.suppression_reason NOT NULL, source text, note text, created_by uuid, UNIQUE(workspace_id,email_normalized),
  UNIQUE(workspace_id, id)
);

ALTER TABLE public.suppressions ADD FOREIGN KEY (workspace_id, created_by) REFERENCES public.users(workspace_id, id);

CREATE TABLE public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL, summary text, value_prop_md text, price_text text, constraints text, is_active boolean NOT NULL DEFAULT true,
  UNIQUE(workspace_id, id)
);

CREATE TABLE public.offer_services (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  offer_id uuid NOT NULL, service public.potential_service NOT NULL, PRIMARY KEY(workspace_id,offer_id,service)
);

ALTER TABLE public.offer_services ADD FOREIGN KEY (workspace_id, offer_id) REFERENCES public.offers(workspace_id, id);

CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL, subject text NOT NULL, body_md text NOT NULL, offer_id uuid, category text, archived_at timestamptz,
  UNIQUE(workspace_id, id)
);

ALTER TABLE public.email_templates ADD FOREIGN KEY (workspace_id, offer_id) REFERENCES public.offers(workspace_id, id);

CREATE TABLE public.sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL, description text, status public.sequence_status NOT NULL DEFAULT 'DRAFT', created_by uuid,
  UNIQUE(workspace_id, id)
);

ALTER TABLE public.sequences ADD FOREIGN KEY (workspace_id, created_by) REFERENCES public.users(workspace_id, id);

CREATE TABLE public.sequence_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sequence_id uuid NOT NULL, position integer NOT NULL CHECK(position>=1), template_id uuid,
subject_override text, body_override_md text, delay_business_days integer NOT NULL DEFAULT 3 CHECK(delay_business_days>=0),
UNIQUE(workspace_id,sequence_id,position), UNIQUE(workspace_id,id,sequence_id),
CHECK(template_id IS NOT NULL OR (subject_override IS NOT NULL AND body_override_md IS NOT NULL)),
  UNIQUE(workspace_id, id)
);

ALTER TABLE public.sequence_steps ADD FOREIGN KEY (workspace_id, sequence_id) REFERENCES public.sequences(workspace_id, id);

ALTER TABLE public.sequence_steps ADD FOREIGN KEY (workspace_id, template_id) REFERENCES public.email_templates(workspace_id, id);

CREATE TABLE public.enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sequence_id uuid NOT NULL, prospect_id uuid NOT NULL, sender_user_id uuid NOT NULL, sending_domain_id uuid NOT NULL,
status public.enrollment_status NOT NULL DEFAULT 'ACTIVE', current_step integer NOT NULL DEFAULT 1 CHECK(current_step>=1),
next_send_at timestamptz, stop_reason text, ooo_pushes integer NOT NULL DEFAULT 0 CHECK(ooo_pushes BETWEEN 0 AND 2),
enrolled_by uuid NOT NULL, UNIQUE(workspace_id,sequence_id,prospect_id), UNIQUE(workspace_id,id,prospect_id,sequence_id),
  UNIQUE(workspace_id, id)
);

ALTER TABLE public.enrollments ADD FOREIGN KEY (workspace_id, sequence_id) REFERENCES public.sequences(workspace_id, id);

ALTER TABLE public.enrollments ADD FOREIGN KEY (workspace_id, prospect_id) REFERENCES public.prospects(workspace_id, id);

ALTER TABLE public.enrollments ADD FOREIGN KEY (workspace_id, sender_user_id) REFERENCES public.users(workspace_id, id);

ALTER TABLE public.enrollments ADD FOREIGN KEY (workspace_id, sending_domain_id) REFERENCES public.sending_domains(workspace_id, id);

ALTER TABLE public.enrollments ADD FOREIGN KEY (workspace_id, enrolled_by) REFERENCES public.users(workspace_id, id);

CREATE UNIQUE INDEX one_active_enrollment ON public.enrollments(workspace_id,prospect_id) WHERE status='ACTIVE';

CREATE INDEX ON public.enrollments (workspace_id,status,next_send_at);

CREATE INDEX ON public.enrollments (workspace_id,prospect_id);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  enrollment_id uuid, prospect_id uuid NOT NULL, sequence_id uuid, step_id uuid, sender_user_id uuid NOT NULL,
to_email text NOT NULL, from_email text NOT NULL, subject text NOT NULL, body_md text, html text, text text,
provider text NOT NULL DEFAULT 'RESEND', provider_message_id text, message_id_header text,
idempotency_key text NOT NULL, status public.message_status NOT NULL DEFAULT 'QUEUED', is_manual boolean NOT NULL DEFAULT false,
open_count integer NOT NULL DEFAULT 0 CHECK(open_count>=0), click_count integer NOT NULL DEFAULT 0 CHECK(click_count>=0),
sent_at timestamptz, opened_at timestamptz, clicked_at timestamptz, error jsonb,
UNIQUE(workspace_id,idempotency_key), UNIQUE(workspace_id,provider,provider_message_id), UNIQUE(workspace_id,message_id_header),
CHECK((enrollment_id IS NULL AND step_id IS NULL AND sequence_id IS NULL AND is_manual) OR (enrollment_id IS NOT NULL AND step_id IS NOT NULL AND sequence_id IS NOT NULL)),
FOREIGN KEY(workspace_id,enrollment_id,prospect_id,sequence_id) REFERENCES public.enrollments(workspace_id,id,prospect_id,sequence_id),
FOREIGN KEY(workspace_id,step_id,sequence_id) REFERENCES public.sequence_steps(workspace_id,id,sequence_id),
  UNIQUE(workspace_id, id)
);

ALTER TABLE public.messages ADD FOREIGN KEY (workspace_id, prospect_id) REFERENCES public.prospects(workspace_id, id);

ALTER TABLE public.messages ADD FOREIGN KEY (workspace_id, sender_user_id) REFERENCES public.users(workspace_id, id);

CREATE UNIQUE INDEX one_step_message ON public.messages(workspace_id,enrollment_id,step_id) WHERE NOT is_manual;

CREATE INDEX ON public.messages (workspace_id,prospect_id,created_at DESC);

CREATE INDEX ON public.messages (workspace_id,sender_user_id,sent_at);

CREATE INDEX ON public.messages (workspace_id,sent_at);

CREATE TABLE public.replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  prospect_id uuid, message_id uuid, from_email text NOT NULL, to_email text NOT NULL,
subject text, body_text text, snippet text, received_at timestamptz NOT NULL, imap_uid bigint NOT NULL CHECK(imap_uid>0),
imap_uidvalidity bigint NOT NULL CHECK(imap_uidvalidity>0), imap_folder text NOT NULL DEFAULT 'INBOX',
is_read boolean NOT NULL DEFAULT false, assigned_user_id uuid, outcome public.reply_outcome,
ignored_at timestamptz, UNIQUE(workspace_id,imap_folder,imap_uidvalidity,imap_uid),
  UNIQUE(workspace_id, id)
);

ALTER TABLE public.replies ADD FOREIGN KEY (workspace_id, prospect_id) REFERENCES public.prospects(workspace_id, id);

ALTER TABLE public.replies ADD FOREIGN KEY (workspace_id, message_id) REFERENCES public.messages(workspace_id, id);

ALTER TABLE public.replies ADD FOREIGN KEY (workspace_id, assigned_user_id) REFERENCES public.users(workspace_id, id);

CREATE INDEX ON public.replies (workspace_id,assigned_user_id,is_read,received_at DESC);

CREATE INDEX ON public.replies (workspace_id,prospect_id);

CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  type text NOT NULL, payload jsonb NOT NULL DEFAULT '{}', status public.job_status NOT NULL DEFAULT 'PENDING',
run_at timestamptz NOT NULL DEFAULT now(), attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),
max_attempts integer NOT NULL DEFAULT 3 CHECK(max_attempts>0), locked_at timestamptz, locked_by text,
last_error text, dedupe_key text, prospect_id uuid, enrollment_id uuid,
CHECK(status<>'CLAIMED' OR (locked_at IS NOT NULL AND locked_by IS NOT NULL)), UNIQUE(workspace_id,dedupe_key),
  UNIQUE(workspace_id, id)
);

ALTER TABLE public.jobs ADD FOREIGN KEY (workspace_id, prospect_id) REFERENCES public.prospects(workspace_id, id);

ALTER TABLE public.jobs ADD FOREIGN KEY (workspace_id, enrollment_id) REFERENCES public.enrollments(workspace_id, id);

CREATE INDEX ON public.jobs (run_at,created_at) WHERE status='PENDING';

CREATE INDEX ON public.jobs (workspace_id,prospect_id);

CREATE TABLE public.import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  batch_id uuid NOT NULL, row_number integer NOT NULL CHECK(row_number>0), raw_data jsonb NOT NULL, status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','IMPORTED','DUPLICATE','INVALID','SUPPRESSED')), prospect_id uuid, error jsonb, UNIQUE(workspace_id,batch_id,row_number),
  UNIQUE(workspace_id, id)
);

ALTER TABLE public.import_rows ADD FOREIGN KEY (workspace_id, batch_id) REFERENCES public.import_batches(workspace_id, id);

ALTER TABLE public.import_rows ADD FOREIGN KEY (workspace_id, prospect_id) REFERENCES public.prospects(workspace_id, id);

CREATE TABLE public.imap_cursors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  folder text NOT NULL, uidvalidity bigint NOT NULL, last_uid bigint NOT NULL DEFAULT 0, UNIQUE(workspace_id,folder),
  UNIQUE(workspace_id, id)
);

CREATE TABLE public.provider_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  provider text NOT NULL, provider_event_id text NOT NULL, payload jsonb NOT NULL, processed_at timestamptz, UNIQUE(workspace_id,provider,provider_event_id),
  UNIQUE(workspace_id, id)
);

CREATE TABLE public.send_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sender_user_id uuid NOT NULL, sending_domain_id uuid NOT NULL, bucket text NOT NULL CHECK(bucket IN ('USER_DAY','WORKSPACE_HOUR')), bucket_start timestamptz NOT NULL, reserved integer NOT NULL DEFAULT 0 CHECK(reserved>=0), UNIQUE(workspace_id,sender_user_id,sending_domain_id,bucket,bucket_start),
  UNIQUE(workspace_id, id)
);

ALTER TABLE public.send_counters ADD FOREIGN KEY (workspace_id, sender_user_id) REFERENCES public.users(workspace_id, id);

ALTER TABLE public.send_counters ADD FOREIGN KEY (workspace_id, sending_domain_id) REFERENCES public.sending_domains(workspace_id, id);

CREATE TABLE public.dns_cache (
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  domain text PRIMARY KEY CHECK(domain=lower(domain)), has_mx boolean NOT NULL, checked_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid, action text NOT NULL, target_type text NOT NULL, target_id uuid, meta jsonb NOT NULL DEFAULT '{}', ip inet,
  UNIQUE(workspace_id, id)
);

ALTER TABLE public.audit_logs ADD FOREIGN KEY (workspace_id, user_id) REFERENCES public.users(workspace_id, id);

CREATE INDEX ON public.audit_logs (workspace_id,created_at DESC);

CREATE INDEX ON public.users (workspace_id);

CREATE INDEX ON public.accounts (workspace_id);

CREATE INDEX ON public.sessions (workspace_id);

CREATE INDEX ON public.industries (workspace_id);

CREATE INDEX ON public.business_types (workspace_id);

CREATE INDEX ON public.integration_credentials (workspace_id);

CREATE INDEX ON public.sending_domains (workspace_id);

CREATE INDEX ON public.qualification_rules (workspace_id);

CREATE INDEX ON public.lead_sources (workspace_id);

CREATE INDEX ON public.source_runs (workspace_id);

CREATE INDEX ON public.import_batches (workspace_id);

CREATE INDEX ON public.prospects (workspace_id);

CREATE INDEX ON public.prospect_opportunities (workspace_id);

CREATE INDEX ON public.prospect_services (workspace_id);

CREATE INDEX ON public.tags (workspace_id);

CREATE INDEX ON public.prospect_tags (workspace_id);

CREATE INDEX ON public.prospect_notes (workspace_id);

CREATE INDEX ON public.prospect_events (workspace_id);

CREATE INDEX ON public.deleted_emails (workspace_id);

CREATE INDEX ON public.suppressions (workspace_id);

CREATE INDEX ON public.offers (workspace_id);

CREATE INDEX ON public.offer_services (workspace_id);

CREATE INDEX ON public.email_templates (workspace_id);

CREATE INDEX ON public.sequences (workspace_id);

CREATE INDEX ON public.sequence_steps (workspace_id);

CREATE INDEX ON public.enrollments (workspace_id);

CREATE INDEX ON public.messages (workspace_id);

CREATE INDEX ON public.replies (workspace_id);

CREATE INDEX ON public.jobs (workspace_id);

CREATE INDEX ON public.import_rows (workspace_id);

CREATE INDEX ON public.imap_cursors (workspace_id);

CREATE INDEX ON public.provider_events (workspace_id);

CREATE INDEX ON public.send_counters (workspace_id);

CREATE INDEX ON public.audit_logs (workspace_id);

CREATE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.verification_tokens FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.industries FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.business_types FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.integration_credentials FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.sending_domains FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.qualification_rules FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.lead_sources FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.source_runs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.import_batches FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.prospects FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.prospect_opportunities FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.prospect_services FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.tags FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.prospect_tags FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.prospect_notes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.prospect_events FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.deleted_emails FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.suppressions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.offers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.offer_services FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.email_templates FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.sequences FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.sequence_steps FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.enrollments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.replies FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.import_rows FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.imap_cursors FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.provider_events FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.send_counters FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.dns_cache FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE FUNCTION public.seed_workspace_taxonomy() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
INSERT INTO public.industries(workspace_id,industry_slug,label) VALUES (NEW.id,'PROFESSIONAL_SERVICES','Professional Services'),
(NEW.id,'HEALTHCARE','Healthcare'),
(NEW.id,'HOME_SERVICES','Home Services'),
(NEW.id,'CONSTRUCTION_TRADES','Construction & Trades'),
(NEW.id,'PROPERTY_REAL_ESTATE','Property & Real Estate'),
(NEW.id,'HOSPITALITY_FOOD','Hospitality & Food'),
(NEW.id,'BEAUTY_WELLNESS','Beauty & Wellness'),
(NEW.id,'RETAIL_ECOMMERCE','Retail & E-commerce'),
(NEW.id,'AUTOMOTIVE','Automotive'),
(NEW.id,'EDUCATION_TRAINING','Education & Training'),
(NEW.id,'TECHNOLOGY','Technology'),
(NEW.id,'FINANCE_INSURANCE','Finance & Insurance'),
(NEW.id,'CREATIVE_MEDIA','Creative & Media'),
(NEW.id,'TRAVEL_TOURISM','Travel & Tourism'),
(NEW.id,'AGRICULTURE','Agriculture'),
(NEW.id,'MANUFACTURING','Manufacturing'),
(NEW.id,'OTHER','Other');
INSERT INTO public.business_types(workspace_id,industry_slug,label,slug,is_system) VALUES (NEW.id,'PROFESSIONAL_SERVICES','Law Firm','law-firm',true),
(NEW.id,'PROFESSIONAL_SERVICES','Accounting Firm','accounting-firm',true),
(NEW.id,'PROFESSIONAL_SERVICES','Consultancy','consultancy',true),
(NEW.id,'PROFESSIONAL_SERVICES','Recruitment Agency','recruitment-agency',true),
(NEW.id,'HEALTHCARE','Dentist','dentist',true),
(NEW.id,'HEALTHCARE','Physiotherapy Clinic','physiotherapy-clinic',true),
(NEW.id,'HEALTHCARE','Medical Clinic','medical-clinic',true),
(NEW.id,'HEALTHCARE','Optician','optician',true),
(NEW.id,'HEALTHCARE','Private Practice','private-practice',true),
(NEW.id,'HOME_SERVICES','Plumbing Company','plumbing-company',true),
(NEW.id,'HOME_SERVICES','Electrical Contractor','electrical-contractor',true),
(NEW.id,'HOME_SERVICES','Cleaning Company','cleaning-company',true),
(NEW.id,'HOME_SERVICES','Landscaper','landscaper',true),
(NEW.id,'HOME_SERVICES','Pest Control','pest-control',true),
(NEW.id,'CONSTRUCTION_TRADES','Building Contractor','building-contractor',true),
(NEW.id,'CONSTRUCTION_TRADES','Roofer','roofer',true),
(NEW.id,'CONSTRUCTION_TRADES','Renovation Company','renovation-company',true),
(NEW.id,'CONSTRUCTION_TRADES','Groundworks','groundworks',true),
(NEW.id,'PROPERTY_REAL_ESTATE','Estate Agency','estate-agency',true),
(NEW.id,'PROPERTY_REAL_ESTATE','Property Manager','property-manager',true),
(NEW.id,'PROPERTY_REAL_ESTATE','Property Developer','property-developer',true),
(NEW.id,'HOSPITALITY_FOOD','Restaurant','restaurant',true),
(NEW.id,'HOSPITALITY_FOOD','Café','cafe',true),
(NEW.id,'HOSPITALITY_FOOD','Hotel','hotel',true),
(NEW.id,'HOSPITALITY_FOOD','Catering Company','catering-company',true),
(NEW.id,'BEAUTY_WELLNESS','Hair Salon','hair-salon',true),
(NEW.id,'BEAUTY_WELLNESS','Barber Shop','barber-shop',true),
(NEW.id,'BEAUTY_WELLNESS','Spa','spa',true),
(NEW.id,'BEAUTY_WELLNESS','Gym','gym',true),
(NEW.id,'BEAUTY_WELLNESS','Wellness Centre','wellness-centre',true),
(NEW.id,'RETAIL_ECOMMERCE','Retail Store','retail-store',true),
(NEW.id,'RETAIL_ECOMMERCE','Boutique','boutique',true),
(NEW.id,'RETAIL_ECOMMERCE','Online Shop','online-shop',true),
(NEW.id,'AUTOMOTIVE','Auto Repair Shop','auto-repair-shop',true),
(NEW.id,'AUTOMOTIVE','Car Dealership','car-dealership',true),
(NEW.id,'AUTOMOTIVE','Detailing Studio','detailing-studio',true),
(NEW.id,'AUTOMOTIVE','Car Rental','car-rental',true),
(NEW.id,'EDUCATION_TRAINING','Training Company','training-company',true),
(NEW.id,'EDUCATION_TRAINING','Tutoring Service','tutoring-service',true),
(NEW.id,'EDUCATION_TRAINING','Academy','academy',true),
(NEW.id,'EDUCATION_TRAINING','School','school',true),
(NEW.id,'TECHNOLOGY','SaaS Company','saas-company',true),
(NEW.id,'TECHNOLOGY','IT Services','it-services',true),
(NEW.id,'TECHNOLOGY','Software Company','software-company',true),
(NEW.id,'FINANCE_INSURANCE','Financial Adviser','financial-adviser',true),
(NEW.id,'FINANCE_INSURANCE','Insurance Broker','insurance-broker',true),
(NEW.id,'FINANCE_INSURANCE','Insurance Company','insurance-company',true),
(NEW.id,'CREATIVE_MEDIA','Marketing Agency','marketing-agency',true),
(NEW.id,'CREATIVE_MEDIA','Design Studio','design-studio',true),
(NEW.id,'CREATIVE_MEDIA','Photography Studio','photography-studio',true),
(NEW.id,'CREATIVE_MEDIA','Production Company','production-company',true),
(NEW.id,'TRAVEL_TOURISM','Tour Operator','tour-operator',true),
(NEW.id,'TRAVEL_TOURISM','Travel Agency','travel-agency',true),
(NEW.id,'TRAVEL_TOURISM','Accommodation Provider','accommodation-provider',true),
(NEW.id,'AGRICULTURE','Farm','farm',true),
(NEW.id,'AGRICULTURE','Agricultural Services','agricultural-services',true),
(NEW.id,'AGRICULTURE','Agricultural Supplier','agricultural-supplier',true),
(NEW.id,'AGRICULTURE','Food Processor','food-processor',true),
(NEW.id,'MANUFACTURING','Manufacturer','manufacturer',true),
(NEW.id,'MANUFACTURING','Fabricator','fabricator',true),
(NEW.id,'MANUFACTURING','Industrial Supplier','industrial-supplier',true),
(NEW.id,'OTHER','Other','other',true);
RETURN NEW; END $$;
CREATE TRIGGER seed_taxonomy AFTER INSERT ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.seed_workspace_taxonomy();

CREATE FUNCTION public.guard_business_type() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
IF NEW.industry_slug<>OLD.industry_slug OR NEW.workspace_id<>OLD.workspace_id THEN RAISE EXCEPTION 'Business type industry/workspace is immutable' USING ERRCODE='23514'; END IF;
IF NEW.archived_at IS NOT NULL AND OLD.archived_at IS NULL AND EXISTS(SELECT 1 FROM public.prospects WHERE workspace_id=NEW.workspace_id AND business_type_id=NEW.id AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Reassign prospects before archiving business type' USING ERRCODE='23514'; END IF;
RETURN NEW; END $$;
CREATE TRIGGER business_type_guard BEFORE UPDATE ON public.business_types FOR EACH ROW EXECUTE FUNCTION public.guard_business_type();
CREATE FUNCTION public.guard_industry() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
IF TG_OP='DELETE' OR (TG_OP='UPDATE' AND (NEW.industry_slug<>OLD.industry_slug OR NEW.workspace_id<>OLD.workspace_id)) THEN RAISE EXCEPTION 'Industries are fixed; rename the label only' USING ERRCODE='23514'; END IF;
RETURN NEW; END $$;
CREATE TRIGGER industry_guard BEFORE UPDATE OR DELETE ON public.industries FOR EACH ROW EXECUTE FUNCTION public.guard_industry();
CREATE FUNCTION public.derive_company_size() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE n integer; BEGIN
IF NEW.company_size_manual THEN RETURN NEW; END IF;
n=NEW.employee_count;
IF n IS NULL AND NEW.employee_range ~ '^\s*[0-9]+\s*[-–]\s*[0-9]+\s*$' THEN
n=substring(NEW.employee_range FROM '[-–]\s*([0-9]+)\s*$')::integer;
END IF;
IF n IS NOT NULL THEN NEW.company_size=CASE WHEN n=1 THEN 'SOLO'::public.company_size WHEN n<=5 THEN 'MICRO'::public.company_size WHEN n<=20 THEN 'SMALL'::public.company_size WHEN n<=50 THEN 'SMALL_MEDIUM'::public.company_size WHEN n<=200 THEN 'MEDIUM'::public.company_size ELSE 'LARGE'::public.company_size END; END IF;
RETURN NEW; END $$;
CREATE TRIGGER derive_size BEFORE INSERT OR UPDATE OF employee_count,employee_range,company_size_manual ON public.prospects FOR EACH ROW EXECUTE FUNCTION public.derive_company_size();

CREATE FUNCTION public.check_opportunities() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE p_id uuid; w_id uuid; s public.pipeline_stage; BEGIN
IF TG_TABLE_NAME='prospects' THEN p_id=NEW.id; w_id=NEW.workspace_id;
ELSE p_id=coalesce(NEW.prospect_id,OLD.prospect_id); w_id=coalesce(NEW.workspace_id,OLD.workspace_id); END IF;
SELECT stage INTO s FROM public.prospects WHERE id=p_id AND workspace_id=w_id;
IF EXISTS(SELECT 1 FROM public.prospect_opportunities WHERE workspace_id=w_id AND prospect_id=p_id AND opportunity='UNKNOWN') AND
(s<>'NEW' OR (SELECT count(*) FROM public.prospect_opportunities WHERE workspace_id=w_id AND prospect_id=p_id)>1)
THEN RAISE EXCEPTION 'UNKNOWN opportunity is exclusive and allowed only at NEW' USING ERRCODE='23514'; END IF;
RETURN NULL; END $$;
CREATE CONSTRAINT TRIGGER opportunity_set_guard AFTER INSERT OR UPDATE OR DELETE ON public.prospect_opportunities DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.check_opportunities();
CREATE CONSTRAINT TRIGGER opportunity_stage_guard AFTER INSERT OR UPDATE ON public.prospects DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.check_opportunities();
CREATE FUNCTION public.default_opportunity() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
INSERT INTO public.prospect_opportunities(workspace_id,prospect_id,opportunity) VALUES(NEW.workspace_id,NEW.id,'UNKNOWN'); RETURN NEW; END $$;
CREATE TRIGGER default_opportunity AFTER INSERT ON public.prospects FOR EACH ROW EXECUTE FUNCTION public.default_opportunity();

CREATE FUNCTION public.research_gate(w uuid,p uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
SELECT coalesce((SELECT industry_slug IS NOT NULL AND business_type_id IS NOT NULL AND company_size<>'UNKNOWN'
AND fit<>'UNKNOWN' AND country_code IS NOT NULL AND nullif(btrim(contact_name),'') IS NOT NULL AND contact_role IS NOT NULL
AND EXISTS(SELECT 1 FROM public.prospect_opportunities o WHERE o.workspace_id=w AND o.prospect_id=p AND opportunity<>'UNKNOWN')
FROM public.prospects WHERE workspace_id=w AND id=p AND deleted_at IS NULL),false) $$;
CREATE FUNCTION public.qualification_gate(w uuid,p uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
SELECT public.research_gate(w,p) AND coalesce((SELECT fit IN ('STRONG','GOOD') AND priority IN ('HIGH','MEDIUM')
AND contact_email_normalized IS NOT NULL AND contact_quality<>'BOUNCED' AND contactability='OK'
AND EXISTS(SELECT 1 FROM public.prospect_services s WHERE s.workspace_id=w AND s.prospect_id=p)
AND NOT EXISTS(SELECT 1 FROM public.suppressions s WHERE s.workspace_id=w AND s.email_normalized=x.contact_email_normalized)
FROM public.prospects x WHERE workspace_id=w AND id=p),false) $$;
CREATE FUNCTION public.enrollment_gate(w uuid,p uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
SELECT coalesce((SELECT stage IN ('QUALIFIED','CONTACTED','FOLLOW_UP') AND priority NOT IN ('LOW','DISQUALIFIED')
AND fit NOT IN ('POOR','UNKNOWN') AND contact_email_normalized IS NOT NULL AND contactability='OK' AND deleted_at IS NULL
AND NOT EXISTS(SELECT 1 FROM public.suppressions s WHERE s.workspace_id=w AND s.email_normalized=x.contact_email_normalized)
AND NOT EXISTS(SELECT 1 FROM public.enrollments e WHERE e.workspace_id=w AND e.prospect_id=p AND e.status='ACTIVE')
FROM public.prospects x WHERE workspace_id=w AND id=p),false) $$;

CREATE FUNCTION public.manual_transition_allowed(f public.pipeline_stage,t public.pipeline_stage) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM (VALUES ('NEW','RESEARCHED'),('NEW','DISQUALIFIED'),('RESEARCHED','QUALIFIED'),('RESEARCHED','NEW'),('RESEARCHED','DISQUALIFIED'),('RESEARCHED','LOST'),('QUALIFIED','CONTACTED'),('QUALIFIED','NEW'),('QUALIFIED','RESEARCHED'),('QUALIFIED','MEETING'),('QUALIFIED','DISQUALIFIED'),('QUALIFIED','LOST'),('CONTACTED','FOLLOW_UP'),('CONTACTED','REPLIED'),('CONTACTED','MEETING'),('CONTACTED','PROPOSAL'),('CONTACTED','LOST'),('CONTACTED','DISQUALIFIED'),('FOLLOW_UP','REPLIED'),('FOLLOW_UP','MEETING'),('FOLLOW_UP','PROPOSAL'),('FOLLOW_UP','LOST'),('FOLLOW_UP','DISQUALIFIED'),('REPLIED','CONTACTED'),('REPLIED','MEETING'),('REPLIED','PROPOSAL'),('REPLIED','LOST'),('REPLIED','DISQUALIFIED'),('MEETING','PROPOSAL'),('MEETING','WON'),('MEETING','LOST'),('MEETING','DISQUALIFIED'),('PROPOSAL','WON'),('PROPOSAL','LOST'),('PROPOSAL','DISQUALIFIED'),('LOST','RESEARCHED'),('DISQUALIFIED','NEW')) v(f,t) WHERE v.f=$1::text AND v.t=$2::text) $$;

-- Auth.js service must SET LOCAL app.actor_id and app.transition_reason in the same transaction.
-- System workers use app.transition_origin=SYSTEM after authenticating the job/webhook.
CREATE FUNCTION public.guard_prospect_transition() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE actor uuid; r public.user_role; origin text; reason text; allowed boolean; BEGIN
actor=nullif(current_setting('app.actor_id',true),'')::uuid;
origin=coalesce(nullif(current_setting('app.transition_origin',true),''),'MANUAL');
reason=nullif(btrim(current_setting('app.transition_reason',true)),'');
IF NEW.priority='DISQUALIFIED' THEN NEW.stage='DISQUALIFIED'; END IF;
IF TG_OP='INSERT' THEN IF NEW.stage<>'NEW' THEN RAISE EXCEPTION 'Create prospects at NEW'; END IF; RETURN NEW; END IF;
IF NEW.stage=OLD.stage THEN RETURN NEW; END IF;
SELECT role INTO r FROM public.users WHERE id=actor AND workspace_id=NEW.workspace_id AND status='ACTIVE';
IF origin<>'SYSTEM' AND r IS NULL THEN RAISE EXCEPTION 'Active workspace actor is required' USING ERRCODE='42501'; END IF;
allowed=public.manual_transition_allowed(OLD.stage,NEW.stage);
IF origin='SYSTEM' THEN
allowed=(OLD.stage='QUALIFIED' AND NEW.stage='CONTACTED') OR (OLD.stage='CONTACTED' AND NEW.stage='FOLLOW_UP')
OR (OLD.stage IN ('QUALIFIED','CONTACTED','FOLLOW_UP') AND NEW.stage='REPLIED') OR (NEW.stage='DISQUALIFIED');
END IF;
IF NOT allowed THEN RAISE EXCEPTION 'Invalid stage transition: % -> %',OLD.stage,NEW.stage USING ERRCODE='23514'; END IF;
IF NEW.stage IN ('RESEARCHED','QUALIFIED') AND NOT public.research_gate(NEW.workspace_id,NEW.id) THEN RAISE EXCEPTION 'Research gate incomplete' USING ERRCODE='23514'; END IF;
IF NEW.stage='QUALIFIED' AND NOT public.qualification_gate(NEW.workspace_id,NEW.id) THEN
IF r NOT IN ('ADMIN','OWNER') OR r IS NULL OR length(btrim(coalesce(NEW.gate_override_reason,'')))<10 THEN RAISE EXCEPTION 'Qualification gate failed; admin override needs reason >=10 characters' USING ERRCODE='23514'; END IF;
NEW.gate_override_by=actor; NEW.gate_override_at=now();
ELSIF NEW.stage='QUALIFIED' THEN NEW.gate_override_reason=NULL; NEW.gate_override_by=NULL; NEW.gate_override_at=NULL;
END IF;
IF NEW.stage IN ('LOST','DISQUALIFIED') AND length(btrim(coalesce(NEW.closed_reason,'')))<3 THEN RAISE EXCEPTION 'closed_reason >=3 characters required' USING ERRCODE='23514'; END IF;
IF OLD.stage='DISQUALIFIED' AND NEW.stage='NEW' AND NEW.priority='DISQUALIFIED' THEN RAISE EXCEPTION 'Change priority to reopen'; END IF;
INSERT INTO public.audit_logs(workspace_id,user_id,action,target_type,target_id,meta)
VALUES(NEW.workspace_id,actor,'PROSPECT_STAGE_CHANGED','prospect',NEW.id,jsonb_build_object('from',OLD.stage,'to',NEW.stage,'reason',coalesce(reason,NEW.closed_reason),'origin',origin,'gate_override_reason',NEW.gate_override_reason));
INSERT INTO public.prospect_events(workspace_id,prospect_id,type,actor_user_id,payload)
VALUES(NEW.workspace_id,NEW.id,'STAGE_CHANGED',actor,jsonb_build_object('from',OLD.stage,'to',NEW.stage,'reason',coalesce(reason,NEW.closed_reason)));
RETURN NEW; END $$;
CREATE TRIGGER transition_guard BEFORE INSERT OR UPDATE ON public.prospects FOR EACH ROW EXECUTE FUNCTION public.guard_prospect_transition();
CREATE FUNCTION public.guard_enrollment() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
IF NEW.status<>'ACTIVE' OR (TG_OP='UPDATE' AND OLD.status='ACTIVE') THEN RETURN NEW; END IF;
PERFORM 1 FROM public.prospects WHERE workspace_id=NEW.workspace_id AND id=NEW.prospect_id FOR UPDATE;
IF NOT public.enrollment_gate(NEW.workspace_id,NEW.prospect_id) THEN RAISE EXCEPTION 'Enrollment gate failed' USING ERRCODE='23514'; END IF;
IF NOT EXISTS(SELECT 1 FROM public.sequences WHERE workspace_id=NEW.workspace_id AND id=NEW.sequence_id AND status='ACTIVE') THEN RAISE EXCEPTION 'Sequence is not ACTIVE' USING ERRCODE='23514'; END IF;
RETURN NEW; END $$;
CREATE TRIGGER enrollment_guard BEFORE INSERT OR UPDATE ON public.enrollments FOR EACH ROW EXECUTE FUNCTION public.guard_enrollment();

CREATE FUNCTION public.cancel_prospect_outreach(w uuid,p uuid,why text) RETURNS void LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
UPDATE public.enrollments SET status='STOPPED',stop_reason=why,next_send_at=NULL WHERE workspace_id=w AND prospect_id=p AND status IN ('ACTIVE','PAUSED');
UPDATE public.messages SET status='CANCELLED' WHERE workspace_id=w AND prospect_id=p AND status='QUEUED';
UPDATE public.jobs SET status='CANCELLED',locked_at=NULL,locked_by=NULL WHERE workspace_id=w AND prospect_id=p AND type='SEND_STEP' AND status IN ('PENDING','CLAIMED');
END $$;
CREATE FUNCTION public.stop_uncontactable() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
IF NEW.stage='DISQUALIFIED' OR NEW.deleted_at IS NOT NULL OR NEW.contactability<>'OK' THEN
PERFORM public.cancel_prospect_outreach(NEW.workspace_id,NEW.id,CASE WHEN NEW.deleted_at IS NOT NULL THEN 'deleted' WHEN NEW.stage='DISQUALIFIED' THEN 'disqualified' ELSE lower(NEW.contactability::text) END);
END IF;
IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL AND NEW.contact_email_normalized IS NOT NULL THEN
INSERT INTO public.deleted_emails(workspace_id,email_normalized) VALUES(NEW.workspace_id,NEW.contact_email_normalized) ON CONFLICT(workspace_id,email_normalized) DO NOTHING;
END IF;
RETURN NEW; END $$;
CREATE TRIGGER stop_uncontactable AFTER UPDATE ON public.prospects FOR EACH ROW EXECUTE FUNCTION public.stop_uncontactable();
CREATE FUNCTION public.suppress_outreach() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE p uuid; BEGIN
FOR p IN SELECT id FROM public.prospects WHERE workspace_id=NEW.workspace_id AND contact_email_normalized=NEW.email_normalized LOOP
UPDATE public.prospects SET contactability=CASE NEW.reason WHEN 'UNSUBSCRIBED' THEN 'UNSUBSCRIBED'::public.contactability WHEN 'HARD_BOUNCE' THEN 'BOUNCED'::public.contactability ELSE 'DO_NOT_CONTACT'::public.contactability END WHERE workspace_id=NEW.workspace_id AND id=p;
PERFORM public.cancel_prospect_outreach(NEW.workspace_id,p,'suppressed'); END LOOP;
RETURN NEW; END $$;
CREATE TRIGGER suppression_guard AFTER INSERT OR UPDATE ON public.suppressions FOR EACH ROW EXECUTE FUNCTION public.suppress_outreach();
CREATE FUNCTION public.daily_send_limit(w uuid,d uuid,at_time timestamptz DEFAULT now()) RETURNS integer LANGUAGE sql STABLE SET search_path='' AS $$
SELECT coalesce((SELECT least(x.daily_send_cap,5*greatest(0,floor(extract(epoch FROM (at_time-y.verified_at))/86400))::integer)
FROM public.workspaces x JOIN public.sending_domains y ON y.workspace_id=x.id WHERE x.id=w AND y.id=d AND y.verified_at IS NOT NULL AND y.revoked_at IS NULL),0) $$;
CREATE FUNCTION public.claim_jobs(worker text,batch_size integer DEFAULT 10) RETURNS SETOF public.jobs LANGUAGE sql VOLATILE SET search_path='' AS $$
WITH candidates AS (SELECT id FROM public.jobs WHERE status='PENDING' AND run_at<=now() ORDER BY run_at,created_at FOR UPDATE SKIP LOCKED LIMIT greatest(1,least(batch_size,100)))
UPDATE public.jobs j SET status='CLAIMED',locked_at=now(),locked_by=worker,attempts=attempts+1 FROM candidates c WHERE j.id=c.id RETURNING j.* $$;

-- Exactly one ACTIVE owner at transaction commit; bootstrap workspace+owner together.
CREATE FUNCTION public.check_workspace_owner() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE w uuid; BEGIN
IF TG_TABLE_NAME='workspaces' THEN w=coalesce(NEW.id,OLD.id); ELSE w=coalesce(NEW.workspace_id,OLD.workspace_id); END IF;
IF EXISTS(SELECT 1 FROM public.workspaces WHERE id=w) AND (SELECT count(*) FROM public.users WHERE workspace_id=w AND role='OWNER' AND status='ACTIVE')<>1 THEN RAISE EXCEPTION 'Workspace requires exactly one active OWNER' USING ERRCODE='23514'; END IF;
RETURN NULL; END $$;
CREATE CONSTRAINT TRIGGER owner_workspace_guard AFTER INSERT OR UPDATE ON public.workspaces DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.check_workspace_owner();
CREATE CONSTRAINT TRIGGER owner_user_guard AFTER INSERT OR UPDATE OR DELETE ON public.users DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.check_workspace_owner();
CREATE FUNCTION public.validate_workspace_timezone() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=NEW.timezone) THEN RAISE EXCEPTION 'Unknown IANA timezone'; END IF; RETURN NEW; END $$;
CREATE TRIGGER timezone_guard BEFORE INSERT OR UPDATE OF timezone ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.validate_workspace_timezone();

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workspaces FROM PUBLIC, anon, authenticated;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.users FROM PUBLIC, anon, authenticated;

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.accounts FROM PUBLIC, anon, authenticated;

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sessions FROM PUBLIC, anon, authenticated;

ALTER TABLE public.verification_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.verification_tokens FROM PUBLIC, anon, authenticated;

ALTER TABLE public.industries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.industries FROM PUBLIC, anon, authenticated;

ALTER TABLE public.business_types ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_types FROM PUBLIC, anon, authenticated;

ALTER TABLE public.integration_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.integration_credentials FROM PUBLIC, anon, authenticated;

ALTER TABLE public.sending_domains ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sending_domains FROM PUBLIC, anon, authenticated;

ALTER TABLE public.qualification_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.qualification_rules FROM PUBLIC, anon, authenticated;

ALTER TABLE public.lead_sources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lead_sources FROM PUBLIC, anon, authenticated;

ALTER TABLE public.source_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.source_runs FROM PUBLIC, anon, authenticated;

ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.import_batches FROM PUBLIC, anon, authenticated;

ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.prospects FROM PUBLIC, anon, authenticated;

ALTER TABLE public.prospect_opportunities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.prospect_opportunities FROM PUBLIC, anon, authenticated;

ALTER TABLE public.prospect_services ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.prospect_services FROM PUBLIC, anon, authenticated;

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tags FROM PUBLIC, anon, authenticated;

ALTER TABLE public.prospect_tags ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.prospect_tags FROM PUBLIC, anon, authenticated;

ALTER TABLE public.prospect_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.prospect_notes FROM PUBLIC, anon, authenticated;

ALTER TABLE public.prospect_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.prospect_events FROM PUBLIC, anon, authenticated;

ALTER TABLE public.deleted_emails ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.deleted_emails FROM PUBLIC, anon, authenticated;

ALTER TABLE public.suppressions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.suppressions FROM PUBLIC, anon, authenticated;

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.offers FROM PUBLIC, anon, authenticated;

ALTER TABLE public.offer_services ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.offer_services FROM PUBLIC, anon, authenticated;

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_templates FROM PUBLIC, anon, authenticated;

ALTER TABLE public.sequences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sequences FROM PUBLIC, anon, authenticated;

ALTER TABLE public.sequence_steps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sequence_steps FROM PUBLIC, anon, authenticated;

ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.enrollments FROM PUBLIC, anon, authenticated;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.messages FROM PUBLIC, anon, authenticated;

ALTER TABLE public.replies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.replies FROM PUBLIC, anon, authenticated;

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.jobs FROM PUBLIC, anon, authenticated;

ALTER TABLE public.import_rows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.import_rows FROM PUBLIC, anon, authenticated;

ALTER TABLE public.imap_cursors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.imap_cursors FROM PUBLIC, anon, authenticated;

ALTER TABLE public.provider_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.provider_events FROM PUBLIC, anon, authenticated;

ALTER TABLE public.send_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.send_counters FROM PUBLIC, anon, authenticated;

ALTER TABLE public.dns_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dns_cache FROM PUBLIC, anon, authenticated;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_logs FROM PUBLIC, anon, authenticated;

DO $$ DECLARE f record; BEGIN
FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN (
'touch_updated_at','seed_workspace_taxonomy','guard_business_type','guard_industry','derive_company_size','check_opportunities','default_opportunity','research_gate','qualification_gate','enrollment_gate','manual_transition_allowed','guard_prospect_transition','guard_enrollment','cancel_prospect_outreach','stop_uncontactable','suppress_outreach','daily_send_limit','claim_jobs','check_workspace_owner','validate_workspace_timezone') LOOP
EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
END LOOP; END $$;

-- Foreign-key indexes from advisor_fixes.sql.
-- Cover foreign keys without duplicating existing usable leading indexes.
DO $$
DECLARE r record; cols text; index_name text;
BEGIN
FOR r IN
 SELECT c.conname,c.conrelid,c.conkey,n.nspname,t.relname
 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
 WHERE c.contype='f' AND n.nspname='public'
 AND NOT EXISTS (
 SELECT 1 FROM pg_index i WHERE i.indrelid=c.conrelid AND i.indisvalid AND i.indpred IS NULL
 AND (i.indkey::smallint[])[0:cardinality(c.conkey)-1]=c.conkey
 )
LOOP
 SELECT string_agg(quote_ident(a.attname),',' ORDER BY k.ordinality) INTO cols
 FROM unnest(r.conkey) WITH ORDINALITY k(attnum,ordinality)
 JOIN pg_attribute a ON a.attrelid=r.conrelid AND a.attnum=k.attnum;
 index_name='fk_'||substr(md5(r.conrelid::text||r.conname),1,20);
 EXECUTE format('CREATE INDEX %I ON %I.%I (%s)',index_name,r.nspname,r.relname,cols);
END LOOP;
END $$;
