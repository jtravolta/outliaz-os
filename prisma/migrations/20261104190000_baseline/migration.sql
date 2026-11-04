-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "company_size" AS ENUM ('SOLO', 'MICRO', 'SMALL', 'SMALL_MEDIUM', 'MEDIUM', 'LARGE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "contact_quality" AS ENUM ('VERIFIED', 'UNVERIFIED', 'RISKY', 'BOUNCED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "contact_role" AS ENUM ('OWNER', 'FOUNDER', 'MANAGING_DIRECTOR', 'CEO', 'MARKETING_DIRECTOR', 'MARKETING_MANAGER', 'OPERATIONS_DIRECTOR', 'OPERATIONS_MANAGER', 'GENERAL_MANAGER', 'OTHER_DECISION_MAKER');

-- CreateEnum
CREATE TYPE "contactability" AS ENUM ('OK', 'BOUNCED', 'UNSUBSCRIBED', 'DO_NOT_CONTACT');

-- CreateEnum
CREATE TYPE "credential_kind" AS ENUM ('APIFY', 'RESEND', 'IMAP');

-- CreateEnum
CREATE TYPE "enrollment_status" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'STOPPED', 'FAILED');

-- CreateEnum
CREATE TYPE "fit" AS ENUM ('STRONG', 'GOOD', 'POSSIBLE', 'POOR', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "import_status" AS ENUM ('PREVIEW', 'RUNNING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "job_status" AS ENUM ('PENDING', 'CLAIMED', 'DONE', 'DEAD');

-- CreateEnum
CREATE TYPE "job_type" AS ENUM ('APIFY_START', 'APIFY_POLL', 'APIFY_IMPORT', 'SEND_STEP', 'IMAP_SYNC', 'SCHEDULE_SOURCE', 'IMPORT_BATCH', 'EXPORT');

-- CreateEnum
CREATE TYPE "message_status" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'BOUNCED', 'COMPLAINED', 'FAILED');

-- CreateEnum
CREATE TYPE "opportunity" AS ENUM ('NO_WEBSITE', 'OUTDATED_WEBSITE', 'POOR_MOBILE_EXPERIENCE', 'POOR_USER_EXPERIENCE', 'WEAK_BRANDING', 'WEAK_CONVERSION', 'NO_LEAD_CAPTURE', 'NO_ONLINE_BOOKING', 'ECOMMERCE_OPPORTUNITY', 'NEEDS_AUTOMATION', 'NEEDS_WEB_APPLICATION', 'WEBSITE_PERFORMANCE', 'SEO_DISCOVERABILITY', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "priority" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'DISQUALIFIED');

-- CreateEnum
CREATE TYPE "reply_outcome" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE', 'NOT_INTERESTED', 'OOO');

-- CreateEnum
CREATE TYPE "rule_match" AS ENUM ('ALL', 'ANY');

-- CreateEnum
CREATE TYPE "run_status" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'IMPORTED');

-- CreateEnum
CREATE TYPE "sequence_status" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "service" AS ENUM ('WEBSITE_DESIGN', 'WEBSITE_REDESIGN', 'WEBSITE_DEVELOPMENT', 'LANDING_PAGE', 'ECOMMERCE', 'BRAND_IDENTITY', 'BRAND_REFRESH', 'UI_UX_DESIGN', 'WEB_APPLICATION', 'BOOKING_SYSTEM', 'LEAD_GENERATION_SYSTEM', 'BUSINESS_AUTOMATION', 'WEBSITE_OPTIMISATION', 'ONGOING_SUPPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "source_schedule" AS ENUM ('OFF', 'DAILY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "stage" AS ENUM ('NEW', 'RESEARCHED', 'QUALIFIED', 'CONTACTED', 'FOLLOW_UP', 'REPLIED', 'MEETING', 'PROPOSAL', 'WON', 'LOST', 'DISQUALIFIED');

-- CreateEnum
CREATE TYPE "suppression_reason" AS ENUM ('UNSUBSCRIBED', 'HARD_BOUNCE', 'COMPLAINT', 'MANUAL', 'INVALID');

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'INVITED', 'DISABLED');

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "user_id" UUID,
    "action" VARCHAR(80) NOT NULL,
    "target_type" VARCHAR(60),
    "target_id" VARCHAR(80),
    "meta" JSONB NOT NULL DEFAULT '{}',
    "ip" VARCHAR(60),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "industry_slug" VARCHAR(60) NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deleted_emails" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "email_normalized" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deleted_emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dns_cache" (
    "domain" VARCHAR(255) NOT NULL,
    "has_mx" BOOLEAN,
    "checked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dns_cache_pkey" PRIMARY KEY ("domain")
);

-- CreateTable
CREATE TABLE "email_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "subject" VARCHAR(150) NOT NULL,
    "body_md" TEXT NOT NULL,
    "offer_id" UUID,
    "category" VARCHAR(60),
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "sequence_id" UUID NOT NULL,
    "prospect_id" UUID NOT NULL,
    "status" "enrollment_status" NOT NULL DEFAULT 'ACTIVE',
    "current_step" INTEGER NOT NULL DEFAULT 0,
    "next_send_at" TIMESTAMPTZ(6),
    "stop_reason" VARCHAR(60),
    "ooo_pushes" INTEGER NOT NULL DEFAULT 0,
    "enrolled_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "status" "job_status" NOT NULL DEFAULT 'PENDING',
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "csv" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "export_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "kind" VARCHAR(20) NOT NULL DEFAULT 'CSV',
    "file_name" VARCHAR(255),
    "mapping" JSONB NOT NULL DEFAULT '{}',
    "rows" JSONB NOT NULL DEFAULT '[]',
    "status" "import_status" NOT NULL DEFAULT 'PREVIEW',
    "processed" INTEGER NOT NULL DEFAULT 0,
    "rows_total" INTEGER NOT NULL DEFAULT 0,
    "rows_imported" INTEGER NOT NULL DEFAULT 0,
    "rows_invalid" INTEGER NOT NULL DEFAULT 0,
    "rows_duplicate" INTEGER NOT NULL DEFAULT 0,
    "error_report" JSONB NOT NULL DEFAULT '[]',
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "industries" (
    "slug" VARCHAR(60) NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "industries_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "integration_credentials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "kind" "credential_kind" NOT NULL,
    "label" VARCHAR(120),
    "config" JSONB NOT NULL DEFAULT '{}',
    "secret_ciphertext" TEXT,
    "secret_iv" TEXT,
    "secret_tag" TEXT,
    "verified_at" TIMESTAMPTZ(6),
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "type" "job_type" NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" "job_status" NOT NULL DEFAULT 'PENDING',
    "run_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "locked_at" TIMESTAMPTZ(6),
    "locked_by" VARCHAR(80),
    "last_error" TEXT,
    "dedupe_key" VARCHAR(200),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_sources" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "actor_id" VARCHAR(160) NOT NULL,
    "actor_name" VARCHAR(160),
    "input_defaults" JSONB NOT NULL DEFAULT '{}',
    "mapping" JSONB NOT NULL DEFAULT '{}',
    "default_industry" VARCHAR(60),
    "default_market" VARCHAR(60),
    "default_opportunity" "opportunity",
    "qualification_rule_id" UUID,
    "schedule" "source_schedule" NOT NULL DEFAULT 'OFF',
    "schedule_hour" INTEGER NOT NULL DEFAULT 9,
    "verify_mx" BOOLEAN NOT NULL DEFAULT false,
    "allow_role_addresses" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" TIMESTAMPTZ(6),
    "last_run_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "enrollment_id" UUID,
    "prospect_id" UUID NOT NULL,
    "step_id" UUID,
    "to_email" VARCHAR(320) NOT NULL,
    "from_email" VARCHAR(320) NOT NULL,
    "subject" VARCHAR(200) NOT NULL,
    "body_md" TEXT NOT NULL,
    "html" TEXT,
    "text" TEXT,
    "provider" VARCHAR(40) NOT NULL DEFAULT 'resend',
    "provider_message_id" VARCHAR(200),
    "message_id_header" VARCHAR(320),
    "status" "message_status" NOT NULL DEFAULT 'QUEUED',
    "is_manual" BOOLEAN NOT NULL DEFAULT false,
    "open_count" INTEGER NOT NULL DEFAULT 0,
    "click_count" INTEGER NOT NULL DEFAULT 0,
    "sent_at" TIMESTAMPTZ(6),
    "opened_at" TIMESTAMPTZ(6),
    "clicked_at" TIMESTAMPTZ(6),
    "error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "user_id" UUID,
    "kind" VARCHAR(40) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offer_services" (
    "offer_id" UUID NOT NULL,
    "service" "service" NOT NULL,

    CONSTRAINT "offer_services_offer_id_service_pk" PRIMARY KEY ("offer_id","service")
);

-- CreateTable
CREATE TABLE "offers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "summary" TEXT,
    "value_prop_md" TEXT,
    "price_text" VARCHAR(120),
    "constraints" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospect_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "prospect_id" UUID NOT NULL,
    "type" VARCHAR(60) NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "actor_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prospect_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospect_notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "prospect_id" UUID NOT NULL,
    "body_md" TEXT NOT NULL,
    "author_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prospect_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospect_opportunities" (
    "prospect_id" UUID NOT NULL,
    "opportunity" "opportunity" NOT NULL,

    CONSTRAINT "prospect_opportunities_prospect_id_opportunity_pk" PRIMARY KEY ("prospect_id","opportunity")
);

-- CreateTable
CREATE TABLE "prospect_services" (
    "prospect_id" UUID NOT NULL,
    "service" "service" NOT NULL,

    CONSTRAINT "prospect_services_prospect_id_service_pk" PRIMARY KEY ("prospect_id","service")
);

-- CreateTable
CREATE TABLE "prospect_tags" (
    "prospect_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "prospect_tags_prospect_id_tag_id_pk" PRIMARY KEY ("prospect_id","tag_id")
);

-- CreateTable
CREATE TABLE "prospects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "business_name" VARCHAR(200) NOT NULL,
    "website" TEXT,
    "domain_normalized" VARCHAR(255),
    "industry_slug" VARCHAR(60),
    "business_type_id" UUID,
    "company_size" "company_size" NOT NULL DEFAULT 'UNKNOWN',
    "employee_count" INTEGER,
    "city" VARCHAR(120),
    "region" VARCHAR(120),
    "country_code" VARCHAR(2),
    "market" VARCHAR(60),
    "fit" "fit" NOT NULL DEFAULT 'UNKNOWN',
    "priority" "priority" NOT NULL DEFAULT 'MEDIUM',
    "stage" "stage" NOT NULL DEFAULT 'NEW',
    "contactability" "contactability" NOT NULL DEFAULT 'OK',
    "contact_name" VARCHAR(120),
    "contact_first_name" VARCHAR(80),
    "contact_last_name" VARCHAR(80),
    "contact_role" "contact_role",
    "contact_email" VARCHAR(320),
    "contact_email_normalized" VARCHAR(320),
    "contact_phone" VARCHAR(60),
    "contact_linkedin" TEXT,
    "contact_quality" "contact_quality" NOT NULL DEFAULT 'UNKNOWN',
    "next_action" TEXT,
    "follow_up_date" DATE,
    "closed_reason" TEXT,
    "gate_override_reason" TEXT,
    "qualification_rule_id" UUID,
    "qualification_revision" INTEGER,
    "source_id" UUID,
    "source_run_id" UUID,
    "source_label" VARCHAR(160),
    "owner_user_id" UUID,
    "is_duplicate_candidate" BOOLEAN NOT NULL DEFAULT false,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "last_contacted_at" TIMESTAMPTZ(6),
    "last_reply_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prospects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qualification_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "match" "rule_match" NOT NULL DEFAULT 'ALL',
    "conditions" JSONB NOT NULL DEFAULT '[]',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qualification_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "replies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "prospect_id" UUID,
    "message_id" UUID,
    "from_email" VARCHAR(320) NOT NULL,
    "to_email" VARCHAR(320) NOT NULL,
    "subject" VARCHAR(255),
    "body_text" TEXT,
    "snippet" VARCHAR(280),
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "imap_uid" INTEGER,
    "imap_uidvalidity" INTEGER,
    "imap_folder" VARCHAR(60) DEFAULT 'INBOX',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "assigned_user_id" UUID,
    "outcome" "reply_outcome",
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sequence_steps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sequence_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "template_id" UUID,
    "subject_override" VARCHAR(150),
    "body_override_md" TEXT,
    "delay_business_days" INTEGER NOT NULL DEFAULT 3,

    CONSTRAINT "sequence_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sequences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "status" "sequence_status" NOT NULL DEFAULT 'DRAFT',
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "apify_run_id" VARCHAR(160),
    "status" "run_status" NOT NULL DEFAULT 'QUEUED',
    "input" JSONB NOT NULL DEFAULT '{}',
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    "items_fetched" INTEGER NOT NULL DEFAULT 0,
    "items_imported" INTEGER NOT NULL DEFAULT 0,
    "items_duplicate" INTEGER NOT NULL DEFAULT 0,
    "items_invalid" INTEGER NOT NULL DEFAULT 0,
    "items_qualified" INTEGER NOT NULL DEFAULT 0,
    "items_disqualified" INTEGER NOT NULL DEFAULT 0,
    "skipped" JSONB NOT NULL DEFAULT '[]',
    "error" JSONB,
    "sample_items" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppressions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "email_normalized" TEXT NOT NULL,
    "reason" "suppression_reason" NOT NULL,
    "source" VARCHAR(120),
    "note" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suppressions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "label" VARCHAR(60) NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "role" "user_role" NOT NULL DEFAULT 'MEMBER',
    "status" "user_status" NOT NULL DEFAULT 'ACTIVE',
    "avatar_url" TEXT,
    "session_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'Europe/Zurich',
    "send_window_start" VARCHAR(5) NOT NULL DEFAULT '09:00',
    "send_window_end" VARCHAR(5) NOT NULL DEFAULT '17:00',
    "daily_send_cap" INTEGER NOT NULL DEFAULT 50,
    "hourly_send_cap" INTEGER NOT NULL DEFAULT 60,
    "track_opens" BOOLEAN NOT NULL DEFAULT true,
    "track_clicks" BOOLEAN NOT NULL DEFAULT true,
    "unsubscribe_footer" BOOLEAN NOT NULL DEFAULT true,
    "footer_text" TEXT DEFAULT 'Acme Studio · 12 Marlborough Place, London · You are receiving this because we believe it may be relevant to your business.',
    "setup_completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_ws_idx" ON "audit_logs"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "bt_industry_idx" ON "business_types"("industry_slug");

-- CreateIndex
CREATE UNIQUE INDEX "bt_industry_slug_uq" ON "business_types"("industry_slug", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "deleted_emails_uq" ON "deleted_emails"("workspace_id", "email_normalized");

-- CreateIndex
CREATE INDEX "enroll_due_idx" ON "enrollments"("status", "next_send_at");

-- CreateIndex
CREATE UNIQUE INDEX "enroll_one_active_uq" ON "enrollments"("workspace_id", "prospect_id") WHERE (status = 'ACTIVE'::enrollment_status);

-- CreateIndex
CREATE UNIQUE INDEX "enroll_seq_prospect_uq" ON "enrollments"("sequence_id", "prospect_id");

-- CreateIndex
CREATE INDEX "imports_ws_idx" ON "import_batches"("workspace_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "creds_ws_kind_uq" ON "integration_credentials"("workspace_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_dedupe_uq" ON "jobs"("dedupe_key");

-- CreateIndex
CREATE INDEX "jobs_due_idx" ON "jobs"("status", "run_at");

-- CreateIndex
CREATE INDEX "jobs_ws_idx" ON "jobs"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "sources_ws_idx" ON "lead_sources"("workspace_id");

-- CreateIndex
CREATE INDEX "messages_prospect_idx" ON "messages"("prospect_id");

-- CreateIndex
CREATE INDEX "messages_ws_idx" ON "messages"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "notif_ws_idx" ON "notifications"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "events_prospect_idx" ON "prospect_events"("prospect_id", "created_at");

-- CreateIndex
CREATE INDEX "pt_tag_idx" ON "prospect_tags"("tag_id");

-- CreateIndex
CREATE INDEX "prospects_ws_domain_idx" ON "prospects"("workspace_id", "domain_normalized");

-- CreateIndex
CREATE INDEX "prospects_ws_followup_idx" ON "prospects"("workspace_id", "follow_up_date");

-- CreateIndex
CREATE INDEX "prospects_ws_industry_idx" ON "prospects"("workspace_id", "industry_slug");

-- CreateIndex
CREATE INDEX "prospects_ws_stage_idx" ON "prospects"("workspace_id", "stage", "created_at");

-- CreateIndex
CREATE INDEX "prospects_ws_updated_idx" ON "prospects"("workspace_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "prospects_email_uq" ON "prospects"("workspace_id", "contact_email_normalized") WHERE ((contact_email_normalized IS NOT NULL) AND (deleted_at IS NULL));

-- CreateIndex
CREATE INDEX "replies_prospect_idx" ON "replies"("prospect_id");

-- CreateIndex
CREATE INDEX "replies_ws_idx" ON "replies"("workspace_id", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "steps_seq_pos_uq" ON "sequence_steps"("sequence_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "runs_apify_uq" ON "source_runs"("apify_run_id");

-- CreateIndex
CREATE INDEX "runs_source_idx" ON "source_runs"("source_id");

-- CreateIndex
CREATE INDEX "runs_ws_idx" ON "source_runs"("workspace_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "suppressions_uq" ON "suppressions"("workspace_id", "email_normalized");

-- CreateIndex
CREATE UNIQUE INDEX "tags_ws_slug_uq" ON "tags"("workspace_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_uq" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_ws_idx" ON "users"("workspace_id");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- Preserve checks that Prisma introspects but cannot express in schema.prisma.
ALTER TABLE "users" ADD CONSTRAINT "users_email_lower_ck" CHECK (email = lower(email));
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_email_lower_ck" CHECK (contact_email_normalized IS NULL OR contact_email_normalized = lower(contact_email_normalized));

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "business_types" ADD CONSTRAINT "business_types_industry_slug_industries_slug_fk" FOREIGN KEY ("industry_slug") REFERENCES "industries"("slug") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "deleted_emails" ADD CONSTRAINT "deleted_emails_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_enrolled_by_users_id_fk" FOREIGN KEY ("enrolled_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "prospects"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_sequence_id_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "sequences"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "integration_credentials" ADD CONSTRAINT "integration_credentials_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lead_sources" ADD CONSTRAINT "lead_sources_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lead_sources" ADD CONSTRAINT "lead_sources_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "prospects"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_step_id_sequence_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "sequence_steps"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "offer_services" ADD CONSTRAINT "offer_services_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "prospect_events" ADD CONSTRAINT "prospect_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "prospect_events" ADD CONSTRAINT "prospect_events_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "prospects"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "prospect_notes" ADD CONSTRAINT "prospect_notes_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "prospect_notes" ADD CONSTRAINT "prospect_notes_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "prospects"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "prospect_opportunities" ADD CONSTRAINT "prospect_opportunities_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "prospects"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "prospect_services" ADD CONSTRAINT "prospect_services_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "prospects"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "prospect_tags" ADD CONSTRAINT "prospect_tags_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "prospects"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "prospect_tags" ADD CONSTRAINT "prospect_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_business_type_id_business_types_id_fk" FOREIGN KEY ("business_type_id") REFERENCES "business_types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_industry_slug_industries_slug_fk" FOREIGN KEY ("industry_slug") REFERENCES "industries"("slug") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_source_id_lead_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "lead_sources"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_source_run_id_source_runs_id_fk" FOREIGN KEY ("source_run_id") REFERENCES "source_runs"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "qualification_rules" ADD CONSTRAINT "qualification_rules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "qualification_rules" ADD CONSTRAINT "qualification_rules_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "replies" ADD CONSTRAINT "replies_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "replies" ADD CONSTRAINT "replies_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "replies" ADD CONSTRAINT "replies_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "prospects"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "replies" ADD CONSTRAINT "replies_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sequence_steps" ADD CONSTRAINT "sequence_steps_sequence_id_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "sequences"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sequence_steps" ADD CONSTRAINT "sequence_steps_template_id_email_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "email_templates"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sequences" ADD CONSTRAINT "sequences_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sequences" ADD CONSTRAINT "sequences_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "source_runs" ADD CONSTRAINT "source_runs_source_id_lead_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "lead_sources"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "source_runs" ADD CONSTRAINT "source_runs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "suppressions" ADD CONSTRAINT "suppressions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "suppressions" ADD CONSTRAINT "suppressions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
