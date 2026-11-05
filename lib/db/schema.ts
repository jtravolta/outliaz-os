import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import {
  CONTACTABILITY, FITS, JOB_STATUSES, JOB_TYPES, MESSAGE_STATUSES, OPPORTUNITIES,
  OUTCOMES, PRIORITIES, QUALITY, ROLES, SERVICES, SEQUENCE_STATUSES, SIZES,
  STAGES, SUPPRESSION_REASONS, USER_ROLES, USER_STATUSES, ENROLLMENT_STATUSES,
  INDUSTRIES,
} from "@/lib/taxonomy/enums";

const tup = (a: readonly (readonly [string, string])[]) => a.map((x) => x[0]) as [string, ...string[]];
const raws = (a: readonly string[]) => [...a] as [string, ...string[]];

export const userRoleEnum = pgEnum("user_role", raws(tup(USER_ROLES)));
export const userStatusEnum = pgEnum("user_status", raws(tup(USER_STATUSES)));
export const stageEnum = pgEnum("stage", raws(tup(STAGES)));
export const fitEnum = pgEnum("fit", raws(tup(FITS)));
export const priorityEnum = pgEnum("priority", raws(tup(PRIORITIES)));
export const companySizeEnum = pgEnum("company_size", raws(tup(SIZES)));
export const contactabilityEnum = pgEnum("contactability", raws(tup(CONTACTABILITY)));
export const contactRoleEnum = pgEnum("contact_role", raws(tup(ROLES)));
export const contactQualityEnum = pgEnum("contact_quality", raws(tup(QUALITY)));
export const opportunityEnum = pgEnum("opportunity", raws(tup(OPPORTUNITIES)));
export const serviceEnum = pgEnum("service", raws(tup(SERVICES)));
export const suppressionReasonEnum = pgEnum("suppression_reason", raws(tup(SUPPRESSION_REASONS)));
export const sequenceStatusEnum = pgEnum("sequence_status", raws(tup(SEQUENCE_STATUSES)));
export const enrollmentStatusEnum = pgEnum("enrollment_status", raws(tup(ENROLLMENT_STATUSES)));
export const messageStatusEnum = pgEnum("message_status", raws(tup(MESSAGE_STATUSES)));
export const replyOutcomeEnum = pgEnum("reply_outcome", raws(tup(OUTCOMES)));
export const jobTypeEnum = pgEnum("job_type", raws(JOB_TYPES));
export const jobStatusEnum = pgEnum("job_status", raws(JOB_STATUSES));
export const credentialKindEnum = pgEnum("credential_kind", ["APIFY", "RESEND", "IMAP"]);
export const scheduleEnum = pgEnum("source_schedule", ["OFF", "DAILY", "WEEKLY"]);
export const runStatusEnum = pgEnum("run_status", ["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED", "IMPORTED"]);
export const importStatusEnum = pgEnum("import_status", ["PREVIEW", "RUNNING", "DONE", "FAILED"]);
export const matchEnum = pgEnum("rule_match", ["ALL", "ANY"]);

const id = () => uuid("id").primaryKey().defaultRandom();
const created = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updated = () => timestamp("updated_at", { withTimezone: true }).defaultNow().notNull();

/* ── workspace & people ─────────────────────────────────────────────────── */

export const workspaces = pgTable("workspaces", {
  id: id(),
  name: varchar("name", { length: 255 }).notNull(),
  timezone: varchar("timezone", { length: 50 }).default("Europe/Zurich").notNull(),
  sendWindowStart: varchar("send_window_start", { length: 5 }).default("09:00").notNull(),
  sendWindowEnd: varchar("send_window_end", { length: 5 }).default("17:00").notNull(),
  dailySendCap: integer("daily_send_cap").default(50).notNull(),
  hourlySendCap: integer("hourly_send_cap").default(60).notNull(),
  trackOpens: boolean("track_opens").default(true).notNull(),
  trackClicks: boolean("track_clicks").default(true).notNull(),
  unsubscribeFooter: boolean("unsubscribe_footer").default(true).notNull(),
  setupCompletedAt: timestamp("setup_completed_at", { withTimezone: true }),
  createdAt: created(),
  updatedAt: updated(),
});

export const users = pgTable("users", {
  id: id(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  role: userRoleEnum("role").default("MEMBER").notNull(),
  status: userStatusEnum("status").default("ACTIVE").notNull(),
  avatarUrl: text("avatar_url"),
  sessionVersion: integer("session_version").default(1).notNull(),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [
  uniqueIndex("users_email_uq").on(t.email),
  index("users_ws_idx").on(t.workspaceId),
  check("users_email_lower_ck", sql`email = lower(email)`),
]);

export const industries = pgTable("industries", {
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  industrySlug: varchar("industry_slug", { length: 60 }).notNull(),
  label: varchar("label", { length: 100 }).notNull(),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [primaryKey({ columns: [t.workspaceId, t.industrySlug] })]);

export const businessTypes = pgTable("business_types", {
  id: id(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  industrySlug: varchar("industry_slug", { length: 60 }).notNull(),
  label: varchar("label", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull(),
  isSystem: boolean("is_system").default(false).notNull(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [uniqueIndex("bt_industry_slug_uq").on(t.workspaceId, t.industrySlug, t.slug), index("bt_industry_idx").on(t.industrySlug)]);

export const integrationCredentials = pgTable("integration_credentials", {
  id: id(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  kind: credentialKindEnum("kind").notNull(),
  label: varchar("label", { length: 120 }),
  config: jsonb("config").$type<Record<string, unknown>>().default({}).notNull(),
  secretCiphertext: text("secret_ciphertext"),
  secretIv: text("secret_iv"),
  secretTag: text("secret_tag"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  lastError: text("last_error"),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [uniqueIndex("creds_ws_kind_uq").on(t.workspaceId, t.kind)]);

/* ── sourcing ───────────────────────────────────────────────────────────── */

export const leadSources = pgTable("lead_sources", {
  id: id(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 160 }).notNull(),
  description: text("description"),
  actorId: varchar("actor_id", { length: 160 }).notNull(),
  actorName: varchar("actor_name", { length: 160 }),
  inputDefaults: jsonb("input_defaults").$type<Record<string, unknown>>().default({}).notNull(),
  mapping: jsonb("mapping").$type<Record<string, string>>().default({}).notNull(),
  defaultIndustry: varchar("default_industry", { length: 60 }),
  defaultMarket: varchar("default_market", { length: 60 }),
  defaultOpportunity: opportunityEnum("default_opportunity"),
  qualificationRuleId: uuid("qualification_rule_id"),
  schedule: scheduleEnum("schedule").default("OFF").notNull(),
  scheduleHour: integer("schedule_hour").default(9).notNull(),
  verifyMx: boolean("verify_mx").default(false).notNull(),
  allowRoleAddresses: boolean("allow_role_addresses").default(false).notNull(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [index("sources_ws_idx").on(t.workspaceId)]);

export const sourceRuns = pgTable("source_runs", {
  id: id(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  sourceId: uuid("source_id").notNull().references(() => leadSources.id, { onDelete: "cascade" }),
  apifyRunId: varchar("apify_run_id", { length: 160 }),
  apifyDatasetId: varchar("apify_dataset_id", { length: 160 }),
  status: runStatusEnum("status").default("QUEUED").notNull(),
  input: jsonb("input").$type<Record<string, unknown>>().default({}).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  itemsFetched: integer("items_fetched").default(0).notNull(),
  itemsImported: integer("items_imported").default(0).notNull(),
  itemsDuplicate: integer("items_duplicate").default(0).notNull(),
  itemsInvalid: integer("items_invalid").default(0).notNull(),
  itemsQualified: integer("items_qualified").default(0).notNull(),
  itemsDisqualified: integer("items_disqualified").default(0).notNull(),
  error: jsonb("error").$type<{ code: string; message: string } | null>(),
  sampleItems: jsonb("sample_items").$type<Record<string, unknown>[]>().default([]).notNull(),
  createdAt: created(),
}, (t) => [
  uniqueIndex("runs_apify_uq").on(t.apifyRunId),
  index("runs_ws_idx").on(t.workspaceId, t.createdAt),
  index("runs_source_idx").on(t.sourceId),
]);

export const importBatches = pgTable("import_batches", {
  id: id(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  kind: varchar("kind", { length: 20 }).default("CSV").notNull(),
  fileName: varchar("file_name", { length: 255 }),
  mapping: jsonb("mapping").$type<Record<string, string>>().default({}).notNull(),
  status: importStatusEnum("status").default("PREVIEW").notNull(),
  rowsProcessed: integer("rows_processed").default(0).notNull(),
  rowsTotal: integer("rows_total").default(0).notNull(),
  rowsImported: integer("rows_imported").default(0).notNull(),
  rowsInvalid: integer("rows_invalid").default(0).notNull(),
  rowsDuplicate: integer("rows_duplicate").default(0).notNull(),
  rowsSuppressed: integer("rows_suppressed").default(0).notNull(),
  errorReport: jsonb("error_report").$type<{ row: number; reason: string }[]>().default([]).notNull(),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [index("imports_ws_idx").on(t.workspaceId, t.createdAt)]);

export const qualificationRules = pgTable("qualification_rules", {
  id: id(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 160 }).notNull(),
  description: text("description"),
  match: matchEnum("match").default("ALL").notNull(),
  conditions: jsonb("conditions").$type<{ field: string; operator: string; value?: unknown; weight?: number }[]>().default([]).notNull(),
  revision: integer("revision").default(1).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: created(),
  updatedAt: updated(),
});

/* ── prospects ──────────────────────────────────────────────────────────── */

export const prospects = pgTable("prospects", {
  id: id(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  businessName: varchar("business_name", { length: 200 }).notNull(),
  website: text("website"),
  domainNormalized: varchar("domain_normalized", { length: 255 }),
  industrySlug: varchar("industry_slug", { length: 60 }),
  businessTypeId: uuid("business_type_id").references(() => businessTypes.id),
  companySize: companySizeEnum("company_size").default("UNKNOWN").notNull(),
  employeeCount: integer("employee_count"),
  city: varchar("city", { length: 120 }),
  region: varchar("region", { length: 120 }),
  countryCode: varchar("country_code", { length: 2 }),
  market: varchar("market", { length: 60 }),
  fit: fitEnum("fit").default("UNKNOWN").notNull(),
  priority: priorityEnum("priority").default("MEDIUM").notNull(),
  stage: stageEnum("stage").default("NEW").notNull(),
  contactability: contactabilityEnum("contactability").default("OK").notNull(),
  contactName: varchar("contact_name", { length: 120 }),
  contactFirstName: varchar("contact_first_name", { length: 80 }),
  contactLastName: varchar("contact_last_name", { length: 80 }),
  contactRole: contactRoleEnum("contact_role"),
  contactEmail: varchar("contact_email", { length: 320 }),
  contactEmailNormalized: varchar("contact_email_normalized", { length: 320 }),
  contactPhone: varchar("contact_phone", { length: 60 }),
  contactLinkedin: text("contact_linkedin"),
  contactQuality: contactQualityEnum("contact_quality").default("UNKNOWN").notNull(),
  nextAction: text("next_action"),
  followUpDate: date("follow_up_date"),
  closedReason: text("closed_reason"),
  gateOverrideReason: text("gate_override_reason"),
  qualificationRuleId: uuid("qualification_rule_id"),
  qualificationRevision: integer("qualification_revision"),
  sourceId: uuid("source_id").references(() => leadSources.id, { onDelete: "set null" }),
  sourceRunId: uuid("source_run_id").references(() => sourceRuns.id, { onDelete: "set null" }),
  ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
  isDuplicateCandidate: boolean("is_duplicate_candidate").default(false).notNull(),
  customFields: jsonb("custom_fields").$type<Record<string, unknown>>().default({}).notNull(),
  lastContactedAt: timestamp("last_contacted_at", { withTimezone: true }),
  lastReplyAt: timestamp("last_reply_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [
  uniqueIndex("prospects_email_uq").on(t.workspaceId, t.contactEmailNormalized)
    .where(sql`contact_email_normalized is not null and deleted_at is null`),
  index("prospects_ws_stage_idx").on(t.workspaceId, t.stage, t.createdAt),
  index("prospects_ws_industry_idx").on(t.workspaceId, t.industrySlug),
  index("prospects_ws_followup_idx").on(t.workspaceId, t.followUpDate),
  index("prospects_ws_domain_idx").on(t.workspaceId, t.domainNormalized),
  index("prospects_ws_updated_idx").on(t.workspaceId, t.updatedAt),
  check("prospects_email_lower_ck", sql`contact_email_normalized is null or contact_email_normalized = lower(contact_email_normalized)`),
]);

export const prospectOpportunities = pgTable("prospect_opportunities", {
  prospectId: uuid("prospect_id").notNull().references(() => prospects.id, { onDelete: "cascade" }),
  opportunity: opportunityEnum("opportunity").notNull(),
}, (t) => [primaryKey({ columns: [t.prospectId, t.opportunity] })]);

export const prospectServices = pgTable("prospect_services", {
  prospectId: uuid("prospect_id").notNull().references(() => prospects.id, { onDelete: "cascade" }),
  service: serviceEnum("service").notNull(),
}, (t) => [primaryKey({ columns: [t.prospectId, t.service] })]);

export const tags = pgTable("tags", {
  id: id(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  label: varchar("label", { length: 60 }).notNull(),
  slug: varchar("slug", { length: 60 }).notNull(),
  createdAt: created(),
}, (t) => [uniqueIndex("tags_ws_slug_uq").on(t.workspaceId, t.slug)]);

export const prospectTags = pgTable("prospect_tags", {
  prospectId: uuid("prospect_id").notNull().references(() => prospects.id, { onDelete: "cascade" }),
  tagId: uuid("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.prospectId, t.tagId] }), index("pt_tag_idx").on(t.tagId)]);

export const prospectNotes = pgTable("prospect_notes", {
  id: id(),
  prospectId: uuid("prospect_id").notNull().references(() => prospects.id, { onDelete: "cascade" }),
  bodyMd: text("body_md").notNull(),
  authorUserId: uuid("author_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: created(),
});

export const prospectEvents = pgTable("prospect_events", {
  id: id(),
  prospectId: uuid("prospect_id").notNull().references(() => prospects.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 60 }).notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().default({}).notNull(),
  actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: created(),
}, (t) => [index("events_prospect_idx").on(t.prospectId, t.createdAt)]);

export const deletedEmails = pgTable("deleted_emails", {
  id: id(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  emailNormalized: text("email_normalized").notNull(),
  deletedAt: created(),
}, (t) => [uniqueIndex("deleted_emails_uq").on(t.workspaceId, t.emailNormalized)]);

export const suppressions = pgTable("suppressions", {
  id: id(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  emailNormalized: text("email_normalized").notNull(),
  reason: suppressionReasonEnum("reason").notNull(),
  source: varchar("source", { length: 120 }),
  note: text("note"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: created(),
}, (t) => [uniqueIndex("suppressions_uq").on(t.workspaceId, t.emailNormalized)]);

/* ── library ────────────────────────────────────────────────────────────── */

export const offers = pgTable("offers", {
  id: id(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 160 }).notNull(),
  summary: text("summary"),
  valuePropMd: text("value_prop_md"),
  priceText: varchar("price_text", { length: 120 }),
  constraints: text("constraints"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: created(),
  updatedAt: updated(),
});

export const offerServices = pgTable("offer_services", {
  offerId: uuid("offer_id").notNull().references(() => offers.id, { onDelete: "cascade" }),
  service: serviceEnum("service").notNull(),
}, (t) => [primaryKey({ columns: [t.offerId, t.service] })]);

export const emailTemplates = pgTable("email_templates", {
  id: id(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 160 }).notNull(),
  subject: varchar("subject", { length: 150 }).notNull(),
  bodyMd: text("body_md").notNull(),
  offerId: uuid("offer_id").references(() => offers.id, { onDelete: "set null" }),
  category: varchar("category", { length: 60 }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: created(),
  updatedAt: updated(),
});

/* ── outbound ───────────────────────────────────────────────────────────── */

export const sequences = pgTable("sequences", {
  id: id(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 160 }).notNull(),
  description: text("description"),
  status: sequenceStatusEnum("status").default("DRAFT").notNull(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: created(),
  updatedAt: updated(),
});

export const sequenceSteps = pgTable("sequence_steps", {
  id: id(),
  sequenceId: uuid("sequence_id").notNull().references(() => sequences.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  templateId: uuid("template_id").references(() => emailTemplates.id, { onDelete: "set null" }),
  subjectOverride: varchar("subject_override", { length: 150 }),
  bodyOverrideMd: text("body_override_md"),
  delayBusinessDays: integer("delay_business_days").default(3).notNull(),
}, (t) => [uniqueIndex("steps_seq_pos_uq").on(t.sequenceId, t.position)]);

export const enrollments = pgTable("enrollments", {
  id: id(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  sequenceId: uuid("sequence_id").notNull().references(() => sequences.id, { onDelete: "cascade" }),
  prospectId: uuid("prospect_id").notNull().references(() => prospects.id, { onDelete: "cascade" }),
  status: enrollmentStatusEnum("status").default("ACTIVE").notNull(),
  currentStep: integer("current_step").default(0).notNull(),
  nextSendAt: timestamp("next_send_at", { withTimezone: true }),
  stopReason: varchar("stop_reason", { length: 60 }),
  oooPushes: integer("ooo_pushes").default(0).notNull(),
  enrolledBy: uuid("enrolled_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [
  uniqueIndex("enroll_seq_prospect_uq").on(t.sequenceId, t.prospectId),
  uniqueIndex("enroll_one_active_uq").on(t.workspaceId, t.prospectId)
    .where(sql`status = 'ACTIVE'`),
  index("enroll_due_idx").on(t.status, t.nextSendAt),
]);

export const messages = pgTable("messages", {
  id: id(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  enrollmentId: uuid("enrollment_id").references(() => enrollments.id, { onDelete: "set null" }),
  prospectId: uuid("prospect_id").notNull().references(() => prospects.id, { onDelete: "cascade" }),
  stepId: uuid("step_id").references(() => sequenceSteps.id, { onDelete: "set null" }),
  toEmail: varchar("to_email", { length: 320 }).notNull(),
  fromEmail: varchar("from_email", { length: 320 }).notNull(),
  subject: varchar("subject", { length: 200 }).notNull(),
  bodyMd: text("body_md").notNull(),
  html: text("html"),
  text: text("text"),
  provider: varchar("provider", { length: 40 }).default("resend").notNull(),
  providerMessageId: varchar("provider_message_id", { length: 200 }),
  messageIdHeader: varchar("message_id_header", { length: 320 }),
  status: messageStatusEnum("status").default("QUEUED").notNull(),
  isManual: boolean("is_manual").default(false).notNull(),
  openCount: integer("open_count").default(0).notNull(),
  clickCount: integer("click_count").default(0).notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  openedAt: timestamp("opened_at", { withTimezone: true }),
  clickedAt: timestamp("clicked_at", { withTimezone: true }),
  error: text("error"),
  createdAt: created(),
}, (t) => [
  index("messages_ws_idx").on(t.workspaceId, t.createdAt),
  index("messages_prospect_idx").on(t.prospectId),
]);

export const replies = pgTable("replies", {
  id: id(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  prospectId: uuid("prospect_id").references(() => prospects.id, { onDelete: "cascade" }),
  messageId: uuid("message_id").references(() => messages.id, { onDelete: "set null" }),
  fromEmail: varchar("from_email", { length: 320 }).notNull(),
  toEmail: varchar("to_email", { length: 320 }).notNull(),
  subject: varchar("subject", { length: 255 }),
  bodyText: text("body_text"),
  snippet: varchar("snippet", { length: 280 }),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
  imapUid: integer("imap_uid"),
  imapUidvalidity: integer("imap_uidvalidity"),
  imapFolder: varchar("imap_folder", { length: 60 }).default("INBOX"),
  isRead: boolean("is_read").default(false).notNull(),
  assignedUserId: uuid("assigned_user_id").references(() => users.id, { onDelete: "set null" }),
  outcome: replyOutcomeEnum("outcome"),
  createdAt: created(),
}, (t) => [
  index("replies_ws_idx").on(t.workspaceId, t.receivedAt),
  index("replies_prospect_idx").on(t.prospectId),
]);

/* ── infrastructure ─────────────────────────────────────────────────────── */

export const jobs = pgTable("jobs", {
  id: id(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  type: jobTypeEnum("type").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().default({}).notNull(),
  status: jobStatusEnum("status").default("PENDING").notNull(),
  runAt: timestamp("run_at", { withTimezone: true }).defaultNow().notNull(),
  attempts: integer("attempts").default(0).notNull(),
  maxAttempts: integer("max_attempts").default(5).notNull(),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  lockedBy: varchar("locked_by", { length: 80 }),
  lastError: text("last_error"),
  dedupeKey: varchar("dedupe_key", { length: 200 }),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [
  uniqueIndex("jobs_dedupe_uq").on(t.dedupeKey),
  index("jobs_due_idx").on(t.status, t.runAt),
  index("jobs_ws_idx").on(t.workspaceId, t.createdAt),
]);

export const dnsCache = pgTable("dns_cache", {
  domain: varchar("domain", { length: 255 }).primaryKey(),
  hasMx: boolean("has_mx"),
  checkedAt: timestamp("checked_at", { withTimezone: true }).defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: id(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  action: varchar("action", { length: 80 }).notNull(),
  targetType: varchar("target_type", { length: 60 }),
  targetId: varchar("target_id", { length: 80 }),
  meta: jsonb("meta").$type<Record<string, unknown>>().default({}).notNull(),
  ip: varchar("ip", { length: 60 }),
  createdAt: created(),
}, (t) => [index("audit_ws_idx").on(t.workspaceId, t.createdAt)]);

export const importRows = pgTable("import_rows", {
  id: id(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  batchId: uuid("batch_id").notNull().references(() => importBatches.id, { onDelete: "cascade" }),
  rowNumber: integer("row_number").notNull(),
  rawData: jsonb("raw_data").$type<Record<string, unknown>>().default({}).notNull(),
  status: varchar("status", { length: 20 }).default("PENDING").notNull(),
  prospectId: uuid("prospect_id").references(() => prospects.id, { onDelete: "set null" }),
  error: jsonb("error").$type<Record<string, unknown> | null>(),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [uniqueIndex("import_rows_batch_row_uq").on(t.workspaceId, t.batchId, t.rowNumber)]);

export const TAXONOMY_INDUSTRY_SLUGS = INDUSTRIES.map((i) => i[0]);
