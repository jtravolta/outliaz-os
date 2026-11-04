import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  businessTypes,
  deletedEmails,
  enrollments,
  messages,
  prospectNotes,
  prospectOpportunities,
  prospectEvents,
  prospectServices,
  prospectTags,
  prospects,
  suppressions,
  tags,
  users,
} from "@/lib/db/schema";
import type { Ctx } from "./common";
import { audit, event, fail, requireRole } from "./common";
import {
  CLOSED,
  allowedTransitions,
  canTransition,
  qualificationMissing,
  researchMissing,
  type ProspectLike,
} from "@/lib/taxonomy/gates";
import {
  deriveSize,
  normalizeCountry,
  normalizeDomain,
  normalizeEmail,
  SERVICE_SUGGESTIONS,
  slugify,
} from "@/lib/taxonomy/enums";

export type ProspectFilters = {
  q?: string;
  stages?: string[];
  industry?: string;
  businessTypeId?: string;
  size?: string;
  country?: string;
  region?: string;
  city?: string;
  market?: string;
  opportunities?: string[];
  services?: string[];
  fit?: string;
  priority?: string;
  quality?: string;
  contactability?: string;
  hasEmail?: boolean;
  gate?: "research" | "qualification" | "blocked";
  ownerId?: string;
  tag?: string;
  followUp?: "overdue" | "today" | "week" | "missing";
  sort?: "newest" | "followup" | "business" | "updated";
  page?: number;
  pageSize?: number;
  includeDeleted?: boolean;
};

export type ProspectWithRelations = ProspectLike & {
  id: string;
  business_name: string;
  domain_normalized: string | null;
  website: string | null;
  employee_count: number | null;
  city: string | null;
  region: string | null;
  contact_phone: string | null;
  contact_linkedin: string | null;
  contact_first_name: string | null;
  contact_last_name: string | null;
  market: string | null;
  next_action: string | null;
  follow_up_date: string | null;
  closed_reason: string | null;
  gate_override_reason: string | null;
  owner_user_id: string | null;
  source_label: string | null;
  source_id: string | null;
  source_run_id: string | null;
  is_duplicate_candidate: boolean;
  custom_fields: Record<string, unknown>;
  last_contacted_at: Date | null;
  last_reply_at: Date | null;
  created_at: Date;
  updated_at: Date;
  business_type_label: string | null;
  tags: { id: string; label: string }[];
  suppressed: boolean;
  active_enrollment: { id: string; sequence_id: string; status: string } | null;
};

const hydrate = async (
  rows: (typeof prospects.$inferSelect)[],
): Promise<ProspectWithRelations[]> => {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [opps, svcs, tagRows, supp, active, bt] = await Promise.all([
    db
      .select()
      .from(prospectOpportunities)
      .where(inArray(prospectOpportunities.prospectId, ids)),
    db
      .select()
      .from(prospectServices)
      .where(inArray(prospectServices.prospectId, ids)),
    db
      .select({
        prospectId: prospectTags.prospectId,
        id: tags.id,
        label: tags.label,
      })
      .from(prospectTags)
      .innerJoin(tags, eq(tags.id, prospectTags.tagId))
      .where(inArray(prospectTags.prospectId, ids)),
    db
      .select({ email: suppressions.emailNormalized })
      .from(suppressions)
      .where(
        inArray(
          suppressions.emailNormalized,
          rows.map((r) => r.contactEmailNormalized).filter(Boolean) as string[],
        ),
      ),
    db
      .select({
        id: enrollments.id,
        prospectId: enrollments.prospectId,
        sequenceId: enrollments.sequenceId,
        status: enrollments.status,
      })
      .from(enrollments)
      .where(
        and(
          inArray(enrollments.prospectId, ids),
          eq(enrollments.status, "ACTIVE"),
        ),
      ),
    db
      .select({ id: businessTypes.id, label: businessTypes.label })
      .from(businessTypes),
  ]);

  const suppressed = new Set(supp.map((s) => s.email));
  const btMap = new Map(bt.map((b) => [b.id, b.label]));

  return rows.map((r) => ({
    ...r,
    business_name: r.businessName,
    domain_normalized: r.domainNormalized,
    website: r.website,
    employee_count: r.employeeCount,
    city: r.city,
    region: r.region,
    contact_phone: r.contactPhone,
    contact_linkedin: r.contactLinkedin,
    contact_first_name: r.contactFirstName,
    contact_last_name: r.contactLastName,
    market: r.market,
    next_action: r.nextAction,
    follow_up_date: r.followUpDate,
    closed_reason: r.closedReason,
    gate_override_reason: r.gateOverrideReason,
    owner_user_id: r.ownerUserId,
    source_label: r.sourceLabel,
    source_id: r.sourceId,
    source_run_id: r.sourceRunId,
    is_duplicate_candidate: r.isDuplicateCandidate,
    custom_fields: r.customFields,
    last_contacted_at: r.lastContactedAt,
    last_reply_at: r.lastReplyAt,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
    industry_slug: r.industrySlug,
    business_type_id: r.businessTypeId,
    company_size: r.companySize,
    country_code: r.countryCode,
    contact_name: r.contactName,
    contact_role: r.contactRole,
    contact_email: r.contactEmail,
    contact_quality: r.contactQuality,
    contactability: r.contactability,
    fit: r.fit,
    priority: r.priority,
    stage: r.stage,
    opportunities: opps
      .filter((o) => o.prospectId === r.id)
      .map((o) => o.opportunity),
    services: svcs.filter((s) => s.prospectId === r.id).map((s) => s.service),
    tags: tagRows
      .filter((t) => t.prospectId === r.id)
      .map((t) => ({ id: t.id, label: t.label })),
    suppressed: !!(
      r.contactEmailNormalized && suppressed.has(r.contactEmailNormalized)
    ),
    active_enrollment: active.find((a) => a.prospectId === r.id)
      ? {
          id: active.find((a) => a.prospectId === r.id)!.id,
          sequence_id: active.find((a) => a.prospectId === r.id)!.sequenceId,
          status: "ACTIVE",
        }
      : null,
    business_type_label: r.businessTypeId
      ? (btMap.get(r.businessTypeId) ?? null)
      : null,
  }));
};

function whereClause(ws: string, f: ProspectFilters): SQL | undefined {
  const parts: (SQL | undefined)[] = [eq(prospects.workspaceId, ws)];
  if (!f.includeDeleted) parts.push(isNull(prospects.deletedAt));
  if (f.stages?.length)
    parts.push(inArray(prospects.stage, f.stages as never[]));
  if (f.industry) parts.push(eq(prospects.industrySlug, f.industry));
  if (f.businessTypeId)
    parts.push(eq(prospects.businessTypeId, f.businessTypeId));
  if (f.size) parts.push(eq(prospects.companySize, f.size as never));
  if (f.country) parts.push(eq(prospects.countryCode, f.country.toUpperCase()));
  if (f.region) parts.push(eq(prospects.region, f.region));
  if (f.city) parts.push(eq(prospects.city, f.city));
  if (f.market) parts.push(eq(prospects.market, f.market));
  if (f.fit) parts.push(eq(prospects.fit, f.fit as never));
  if (f.priority) parts.push(eq(prospects.priority, f.priority as never));
  if (f.quality) parts.push(eq(prospects.contactQuality, f.quality as never));
  if (f.contactability)
    parts.push(eq(prospects.contactability, f.contactability as never));
  if (f.ownerId) parts.push(eq(prospects.ownerUserId, f.ownerId));
  if (f.hasEmail === true)
    parts.push(sql`${prospects.contactEmailNormalized} is not null`);
  if (f.hasEmail === false)
    parts.push(sql`${prospects.contactEmailNormalized} is null`);
  if (f.q) {
    const term = `%${f.q.trim().toLowerCase()}%`;
    parts.push(
      or(
        sql`lower(${prospects.businessName}) like ${term}`,
        sql`lower(coalesce(${prospects.contactName}, '')) like ${term}`,
        sql`lower(coalesce(${prospects.contactEmail}, '')) like ${term}`,
        sql`lower(coalesce(${prospects.domainNormalized}, '')) like ${term}`,
        sql`lower(coalesce(${prospects.city}, '')) like ${term}`,
      ),
    );
  }
  if (f.opportunities?.length) {
    parts.push(
      sql`exists (select 1 from prospect_opportunities po where po.prospect_id = ${prospects.id} and po.opportunity = any(${f.opportunities}))`,
    );
  }
  if (f.services?.length) {
    parts.push(
      sql`exists (select 1 from prospect_services ps where ps.prospect_id = ${prospects.id} and ps.service = any(${f.services}))`,
    );
  }
  if (f.tag) {
    parts.push(
      sql`exists (select 1 from prospect_tags pt join tags t on t.id = pt.tag_id where pt.prospect_id = ${prospects.id} and t.slug = ${slugify(f.tag)})`,
    );
  }
  const today = new Date().toISOString().slice(0, 10);
  if (f.followUp === "overdue")
    parts.push(
      and(
        sql`${prospects.followUpDate} is not null`,
        sql`${prospects.followUpDate} < ${today}`,
      )!,
    );
  if (f.followUp === "today")
    parts.push(sql`${prospects.followUpDate} = ${today}`);
  if (f.followUp === "week") {
    const week = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    parts.push(
      and(
        sql`${prospects.followUpDate} is not null`,
        sql`${prospects.followUpDate} <= ${week}`,
      )!,
    );
  }
  if (f.followUp === "missing")
    parts.push(sql`${prospects.followUpDate} is null`);
  return and(...parts);
}

export async function listProspects(ctx: Ctx, f: ProspectFilters) {
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, f.pageSize ?? 50));
  const where = whereClause(ctx.user.workspaceId, f);

  const order =
    f.sort === "business"
      ? asc(prospects.businessName)
      : f.sort === "followup"
        ? asc(prospects.followUpDate)
        : f.sort === "updated"
          ? desc(prospects.updatedAt)
          : desc(prospects.createdAt);

  // Gate filtering can't be expressed cheaply in SQL (it depends on relations),
  // so when requested we hydrate a bounded set and slice in memory.
  if (f.gate) {
    const rows = await db
      .select()
      .from(prospects)
      .where(where)
      .orderBy(order)
      .limit(1500);
    const hydrated = await hydrate(rows);
    const filtered = hydrated.filter((p) => {
      if (f.gate === "blocked")
        return (
          (p.stage === "NEW" && researchMissing(p).length > 0) ||
          (p.stage === "RESEARCHED" && qualificationMissing(p).length > 0)
        );
      if (f.gate === "research")
        return p.stage === "NEW" && researchMissing(p).length === 0;
      return p.stage === "RESEARCHED" && qualificationMissing(p).length === 0;
    });
    return {
      rows: filtered.slice((page - 1) * pageSize, page * pageSize),
      total: filtered.length,
      page,
      pageSize,
    };
  }

  const [rows, countRows] = await Promise.all([
    db
      .select()
      .from(prospects)
      .where(where)
      .orderBy(order)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(prospects)
      .where(where),
  ]);

  return {
    rows: await hydrate(rows),
    total: countRows[0]?.count ?? 0,
    page,
    pageSize,
  };
}

export async function getProspect(ctx: Ctx, id: string) {
  const [row] = await db
    .select()
    .from(prospects)
    .where(
      and(
        eq(prospects.id, id),
        eq(prospects.workspaceId, ctx.user.workspaceId),
        isNull(prospects.deletedAt),
      ),
    );
  if (!row) throw fail("NOT_FOUND", "Prospect not found", 404);
  const [p] = await hydrate([row]);
  return p;
}

export type OutreachDraft = {
  subject: string;
  body: string;
  updatedAt: string;
  updatedBy: string;
};

export async function getOutreachDraft(
  ctx: Ctx,
  id: string,
): Promise<OutreachDraft | null> {
  const prospect = await getProspect(ctx, id);
  const draft = prospect.custom_fields?.outreachDraft;
  if (!draft || typeof draft !== "object") return null;
  const value = draft as Partial<OutreachDraft>;
  if (typeof value.subject !== "string" || typeof value.body !== "string")
    return null;
  return {
    subject: value.subject,
    body: value.body,
    updatedAt: value.updatedAt ?? prospect.updated_at.toISOString(),
    updatedBy: value.updatedBy ?? ctx.user.userId,
  };
}

export async function saveOutreachDraft(
  ctx: Ctx,
  id: string,
  input: { subject?: unknown; body?: unknown },
) {
  const prospect = await getProspect(ctx, id);
  const subject = typeof input.subject === "string" ? input.subject.trim() : "";
  const body = typeof input.body === "string" ? input.body.trim() : "";
  if (!subject || !body)
    throw fail("VALIDATION", "Subject and body are required");
  if (subject.length > 200)
    throw fail("VALIDATION", "Subject must be 200 characters or fewer");
  const draft: OutreachDraft = {
    subject,
    body,
    updatedAt: new Date().toISOString(),
    updatedBy: ctx.user.userId,
  };
  await db
    .update(prospects)
    .set({
      customFields: { ...prospect.custom_fields, outreachDraft: draft },
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(prospects.id, id),
        eq(prospects.workspaceId, ctx.user.workspaceId),
      ),
    );
  await audit(ctx, "prospect.draft_saved", "prospect", id, {
    subjectLength: subject.length,
    bodyLength: body.length,
  });
  return draft;
}

export async function getProspectDetail(ctx: Ctx, id: string) {
  const p = await getProspect(ctx, id);
  const [notes, events, msgs, owner] = await Promise.all([
    db
      .select()
      .from(prospectNotes)
      .where(eq(prospectNotes.prospectId, id))
      .orderBy(desc(prospectNotes.createdAt)),
    db
      .select()
      .from(prospectEvents)
      .where(eq(prospectEvents.prospectId, id))
      .orderBy(desc(prospectEvents.createdAt))
      .limit(80),
    db
      .select()
      .from(messages)
      .where(eq(messages.prospectId, id))
      .orderBy(desc(messages.createdAt)),
    p.owner_user_id
      ? db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(eq(users.id, p.owner_user_id))
      : Promise.resolve([]),
  ]);
  return {
    prospect: p,
    notes,
    events,
    messages: msgs,
    owner: owner[0] ?? null,
    allowedTransitions: allowedTransitions(p.stage),
  };
}

/* ── writes ─────────────────────────────────────────────────────────────── */

export type CreateProspectInput = {
  business_name: string;
  website?: string;
  industry?: string;
  business_type_id?: string;
  employee_count?: number;
  company_size?: string;
  city?: string;
  region?: string;
  country_code?: string;
  market?: string;
  fit?: string;
  priority?: string;
  contact_role?: string;
  contact_name?: string;
  contact_first_name?: string;
  contact_last_name?: string;
  contact_email?: string;
  contact_phone?: string;
  contact_quality?: string;
  opportunities?: string[];
  services?: string[];
  tags?: string[];
  next_action?: string;
  follow_up_date?: string;
  notes?: string;
  source_label?: string;
  source_id?: string;
  source_run_id?: string;
  owner_user_id?: string;
  custom_fields?: Record<string, unknown>;
};

const emailOf = (input: CreateProspectInput) =>
  normalizeEmail(input.contact_email);

export async function createProspect(
  ctx: Ctx,
  input: CreateProspectInput,
  opts: { silent?: boolean } = {},
) {
  const businessName = input.business_name?.trim();
  if (!businessName) throw fail("VALIDATION", "Business name is required");
  const email = emailOf(input);
  if (input.contact_email && !email)
    throw fail("VALIDATION", "Contact email is not valid");

  const first =
    input.contact_first_name?.trim() ||
    input.contact_name?.trim().split(/\s+/)[0] ||
    "";
  const last =
    input.contact_last_name?.trim() ||
    input.contact_name?.trim().split(/\s+/).slice(1).join(" ") ||
    "";
  const contactName =
    [first, last].filter(Boolean).join(" ") ||
    input.contact_name?.trim() ||
    null;

  const employees = input.employee_count ?? null;
  const companySize =
    (input.company_size as never) ?? (deriveSize(employees) as never);

  const [row] = await db
    .insert(prospects)
    .values({
      workspaceId: ctx.user.workspaceId,
      businessName,
      website: input.website?.trim() || null,
      domainNormalized:
        normalizeDomain(input.website) ??
        (email ? normalizeDomain(email.split("@")[1]) : null),
      industrySlug: input.industry || null,
      businessTypeId: input.business_type_id || null,
      employeeCount: employees,
      companySize: companySize ?? "UNKNOWN",
      city: input.city?.trim() || null,
      region: input.region?.trim() || null,
      countryCode: normalizeCountry(input.country_code),
      market: input.market?.trim() || null,
      fit: (input.fit as never) ?? "UNKNOWN",
      priority: (input.priority as never) ?? "MEDIUM",
      contactName,
      contactFirstName: first || null,
      contactLastName: last || null,
      contactRole: (input.contact_role as never) ?? null,
      contactEmail: input.contact_email?.trim() || null,
      contactEmailNormalized: email,
      contactPhone: input.contact_phone?.trim() || null,
      contactQuality:
        (input.contact_quality as never) ?? (email ? "UNVERIFIED" : "UNKNOWN"),
      nextAction: input.next_action || null,
      followUpDate: input.follow_up_date || null,
      sourceId: input.source_id || null,
      sourceRunId: input.source_run_id || null,
      sourceLabel: input.source_label || "manual",
      ownerUserId: input.owner_user_id || ctx.user.userId,
      customFields: input.custom_fields ?? {},
      stage: input.priority === "DISQUALIFIED" ? "DISQUALIFIED" : "NEW",
    })
    .returning();

  if (input.opportunities?.length) {
    const opps = [...new Set(input.opportunities)].filter(
      (o) => !(o === "UNKNOWN" && row.stage !== "NEW"),
    );
    if (opps.length) {
      await db
        .insert(prospectOpportunities)
        .values(
          opps.map((opportunity) => ({
            prospectId: row.id,
            opportunity: opportunity as never,
          })),
        );
    }
  }
  if (input.services?.length) {
    await db
      .insert(prospectServices)
      .values(
        [...new Set(input.services)].map((service) => ({
          prospectId: row.id,
          service: service as never,
        })),
      );
  }
  if (input.tags?.length) await attachTags(ctx, row.id, input.tags);
  if (input.notes?.trim()) {
    await db
      .insert(prospectNotes)
      .values({
        prospectId: row.id,
        bodyMd: input.notes.trim(),
        authorUserId: ctx.user.userId,
      });
  }
  if (!opts.silent) {
    await event(
      row.id,
      "created",
      { source: input.source_label ?? "manual" },
      ctx.user.userId,
    );
    await audit(ctx, "prospect.create", "prospect", row.id, {
      business: businessName,
    });
  }
  return row;
}

export async function attachTags(
  ctx: Ctx,
  prospectId: string,
  labels: string[],
) {
  for (const label of labels) {
    const clean = label.trim().slice(0, 60);
    if (!clean) continue;
    const slug = slugify(clean);
    if (!slug) continue;
    const [existing] = await db
      .select()
      .from(tags)
      .where(
        and(eq(tags.workspaceId, ctx.user.workspaceId), eq(tags.slug, slug)),
      );
    const tag =
      existing ??
      (
        await db
          .insert(tags)
          .values({ workspaceId: ctx.user.workspaceId, label: clean, slug })
          .returning()
      )[0];
    await db
      .insert(prospectTags)
      .values({ prospectId, tagId: tag.id })
      .onConflictDoNothing();
  }
}

export async function updateProspect(
  ctx: Ctx,
  id: string,
  patch: Partial<CreateProspectInput>,
) {
  const existing = await getProspect(ctx, id);
  const values: Record<string, unknown> = { updatedAt: new Date() };

  const fieldMap: Record<string, string> = {
    business_name: "businessName",
    website: "website",
    industry: "industrySlug",
    business_type_id: "businessTypeId",
    city: "city",
    region: "region",
    market: "market",
    contact_role: "contactRole",
    contact_phone: "contactPhone",
    next_action: "nextAction",
    follow_up_date: "followUpDate",
  };
  for (const [from, to] of Object.entries(fieldMap)) {
    if (patch[from as keyof CreateProspectInput] !== undefined) {
      values[to] = patch[from as keyof CreateProspectInput] || null;
    }
  }
  if (patch.website !== undefined)
    values.domainNormalized = normalizeDomain(patch.website);
  if (patch.country_code !== undefined)
    values.countryCode = normalizeCountry(patch.country_code);
  if (patch.company_size !== undefined) values.companySize = patch.company_size;
  if (patch.employee_count !== undefined) {
    values.employeeCount = patch.employee_count || null;
    if (!patch.company_size)
      values.companySize = deriveSize(patch.employee_count);
  }
  if (patch.fit !== undefined) values.fit = patch.fit;
  if (patch.priority !== undefined) values.priority = patch.priority;
  if (patch.contact_quality !== undefined)
    values.contactQuality = patch.contact_quality;

  if (patch.contact_email !== undefined) {
    const email = normalizeEmail(patch.contact_email);
    if (patch.contact_email && !email)
      throw fail("VALIDATION", "Contact email is not valid");
    values.contactEmail = patch.contact_email || null;
    values.contactEmailNormalized = email;
  }
  if (
    patch.contact_first_name !== undefined ||
    patch.contact_last_name !== undefined ||
    patch.contact_name !== undefined
  ) {
    const first = patch.contact_first_name ?? existing.contact_first_name ?? "";
    const last = patch.contact_last_name ?? existing.contact_last_name ?? "";
    const full =
      [first, last].filter(Boolean).join(" ") || patch.contact_name || "";
    values.contactFirstName = first || null;
    values.contactLastName = last || null;
    values.contactName = full || null;
  }

  if (patch.opportunities) {
    if (
      patch.opportunities.includes("UNKNOWN") &&
      patch.opportunities.length > 1
    ) {
      throw fail("VALIDATION", "Unknown opportunity is mutually exclusive");
    }
    if (patch.opportunities.includes("UNKNOWN") && existing.stage !== "NEW") {
      throw fail(
        "VALIDATION",
        "Unknown opportunity is only allowed at stage New",
      );
    }
    await db
      .delete(prospectOpportunities)
      .where(eq(prospectOpportunities.prospectId, id));
    if (patch.opportunities.length) {
      await db
        .insert(prospectOpportunities)
        .values(
          patch.opportunities.map((opportunity) => ({
            prospectId: id,
            opportunity: opportunity as never,
          })),
        );
    }
  }
  if (patch.services) {
    await db
      .delete(prospectServices)
      .where(eq(prospectServices.prospectId, id));
    if (patch.services.length) {
      await db
        .insert(prospectServices)
        .values(
          patch.services.map((service) => ({
            prospectId: id,
            service: service as never,
          })),
        );
    }
  }
  if (patch.tags) {
    await db.delete(prospectTags).where(eq(prospectTags.prospectId, id));
    await attachTags(ctx, id, patch.tags);
  }

  // Invariant: priority DISQUALIFIED forces stage DISQUALIFIED and cancels sends.
  if (patch.priority === "DISQUALIFIED" && existing.stage !== "DISQUALIFIED") {
    values.stage = "DISQUALIFIED";
    values.closedReason = "Priority set to Disqualified";
    await cancelOutreach(ctx, id, "disqualified");
    await event(
      id,
      "stage_changed",
      {
        from: existing.stage,
        to: "DISQUALIFIED",
        reason: "Priority set to Disqualified",
        system: true,
      },
      ctx.user.userId,
    );
  }

  try {
    const [row] = await db
      .update(prospects)
      .set(values as never)
      .where(eq(prospects.id, id))
      .returning();
    await event(id, "updated", { fields: Object.keys(patch) }, ctx.user.userId);
    await audit(ctx, "prospect.update", "prospect", id, {
      fields: Object.keys(patch),
    });
    return row;
  } catch (err) {
    const e = err as { code?: string };
    if (e.code === "23505")
      throw fail(
        "DUPLICATE_EMAIL",
        "Another prospect already uses that email",
        409,
      );
    throw err;
  }
}

async function cancelOutreach(ctx: Ctx, prospectId: string, reason: string) {
  await db
    .update(enrollments)
    .set({
      status: "STOPPED",
      stopReason: reason,
      nextSendAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(enrollments.prospectId, prospectId),
        eq(enrollments.status, "ACTIVE"),
      ),
    );
  await db
    .delete(messages)
    .where(
      and(eq(messages.prospectId, prospectId), eq(messages.status, "QUEUED")),
    );
}

export async function transitionProspect(
  ctx: Ctx,
  id: string,
  to: string,
  opts: { reason?: string; override?: boolean; system?: boolean } = {},
) {
  const p = await getProspect(ctx, id);

  if (!opts.system && !canTransition(p.stage, to)) {
    throw fail("ILLEGAL_TRANSITION", `Cannot move ${p.stage} → ${to}`, 422, {
      allowed: allowedTransitions(p.stage),
    });
  }
  if (CLOSED.includes(to) && (opts.reason ?? "").trim().length < 3) {
    throw fail(
      "REASON_REQUIRED",
      `A reason is required to mark a prospect ${to.toLowerCase()}`,
      422,
    );
  }

  if (to === "RESEARCHED") {
    const missing = researchMissing(p);
    if (missing.length) {
      throw fail("RESEARCH_GATE", "Research gate is not complete", 422, {
        missing: missing.map((m) => m.key),
      });
    }
  }
  if (to === "QUALIFIED") {
    const missing = qualificationMissing(p);
    if (missing.length) {
      if (!opts.override) {
        throw fail(
          "QUALIFICATION_GATE",
          "Qualification gate is not complete",
          422,
          { missing: missing.map((m) => m.key) },
        );
      }
      if (ctx.user.role !== "OWNER" && ctx.user.role !== "ADMIN") {
        throw fail(
          "FORBIDDEN",
          "Only owners and admins can override the qualification gate",
          403,
        );
      }
      if ((opts.reason ?? "").trim().length < 10) {
        throw fail(
          "REASON_REQUIRED",
          "An override reason of at least 10 characters is required",
          422,
        );
      }
    }
  }

  const values: Record<string, unknown> = { stage: to, updatedAt: new Date() };
  if (CLOSED.includes(to)) values.closedReason = opts.reason!.trim();
  else if (["RESEARCHED", "QUALIFIED", "NEW"].includes(to))
    values.closedReason = null;
  if (to === "QUALIFIED" && opts.override)
    values.gateOverrideReason = opts.reason!.trim();

  if (["LOST", "DISQUALIFIED"].includes(to))
    await cancelOutreach(ctx, id, to.toLowerCase());

  const [row] = await db
    .update(prospects)
    .set(values as never)
    .where(eq(prospects.id, id))
    .returning();
  await event(
    id,
    "stage_changed",
    {
      from: p.stage,
      to,
      reason: opts.reason ?? null,
      override: !!opts.override,
    },
    ctx.user.userId,
  );
  await audit(ctx, "prospect.stage", "prospect", id, {
    from: p.stage,
    to,
    reason: opts.reason ?? null,
  });
  return row;
}

export async function addNote(ctx: Ctx, id: string, body: string) {
  if (!body.trim()) throw fail("VALIDATION", "Note cannot be empty");
  await getProspect(ctx, id);
  const [note] = await db
    .insert(prospectNotes)
    .values({
      prospectId: id,
      bodyMd: body.trim().slice(0, 20000),
      authorUserId: ctx.user.userId,
    })
    .returning();
  await event(
    id,
    "note_added",
    { preview: body.slice(0, 120) },
    ctx.user.userId,
  );
  return note;
}

export async function deleteProspect(ctx: Ctx, id: string) {
  requireRole(ctx, ["OWNER"]);
  const p = await getProspect(ctx, id);
  await db
    .update(prospects)
    .set({ deletedAt: new Date() })
    .where(eq(prospects.id, id));
  if (p.contact_email) {
    const email = normalizeEmail(p.contact_email)!;
    await db
      .insert(deletedEmails)
      .values({ workspaceId: ctx.user.workspaceId, emailNormalized: email })
      .onConflictDoNothing();
  }
  await cancelOutreach(ctx, id, "deleted");
  await audit(ctx, "prospect.delete", "prospect", id, {
    business: p.business_name,
  });
  return { ok: true };
}

export function suggestServices(p: ProspectLike) {
  const set = new Set<string>();
  for (const o of p.opportunities ?? [])
    (SERVICE_SUGGESTIONS[o] ?? []).forEach((s) => set.add(s));
  return [...set];
}

export async function bulkAction(
  ctx: Ctx,
  ids: string[],
  action:
    | "stage"
    | "priority"
    | "fit"
    | "tag"
    | "owner"
    | "suppress"
    | "delete"
    | "assign",
  value?: string,
  reason?: string,
) {
  if (ids.length > 5000)
    throw fail("LIMIT", "Maximum 5,000 prospects per action", 422);
  const results: { id: string; ok: boolean; error?: string }[] = [];

  for (const id of ids) {
    try {
      if (action === "stage")
        await transitionProspect(ctx, id, value!, { reason });
      else if (action === "priority")
        await updateProspect(ctx, id, { priority: value });
      else if (action === "fit") await updateProspect(ctx, id, { fit: value });
      else if (action === "assign")
        await updateProspect(ctx, id, { owner_user_id: value });
      else if (action === "tag") {
        await attachTags(
          ctx,
          id,
          (value ?? "")
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        );
      } else if (action === "suppress") {
        const p = await getProspect(ctx, id);
        if (p.contact_email) {
          await db
            .insert(suppressions)
            .values({
              workspaceId: ctx.user.workspaceId,
              emailNormalized: normalizeEmail(p.contact_email)!,
              reason: "MANUAL",
              source: "bulk action",
              createdBy: ctx.user.userId,
            })
            .onConflictDoNothing();
          await db
            .update(prospects)
            .set({ contactability: "DO_NOT_CONTACT" })
            .where(eq(prospects.id, id));
          await cancelOutreach(ctx, id, "suppressed");
        }
      } else if (action === "delete") {
        await deleteProspect(ctx, id);
      }
      results.push({ id, ok: true });
    } catch (err) {
      results.push({
        id,
        ok: false,
        error: err instanceof Error ? err.message : "failed",
      });
    }
  }

  await audit(ctx, `prospect.bulk.${action}`, "prospect", ids[0], {
    count: ids.length,
    value,
  });
  return {
    results,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
  };
}

export async function mergeProspects(
  ctx: Ctx,
  primaryId: string,
  duplicateId: string,
  fieldWinners: Record<string, "primary" | "duplicate"> = {},
) {
  requireRole(ctx, ["OWNER", "ADMIN"]);
  if (primaryId === duplicateId)
    throw fail("VALIDATION", "Pick two different prospects");
  const primary = await getProspect(ctx, primaryId);
  const duplicate = await getProspect(ctx, duplicateId);

  const values: Record<string, unknown> = { updatedAt: new Date() };
  for (const [field, winner] of Object.entries(fieldWinners)) {
    if (winner !== "duplicate") continue;
    if (field === "contact_email") {
      const email = normalizeEmail(duplicate.contact_email);
      values.contactEmail = duplicate.contact_email;
      values.contactEmailNormalized = email;
      values.contactQuality = duplicate.contact_quality;
      values.contactability = duplicate.contactability;
    } else if (field === "contact_name") {
      values.contactName = duplicate.contact_name;
      values.contactFirstName = duplicate.contact_first_name;
      values.contactLastName = duplicate.contact_last_name;
    } else if (field === "website") {
      values.website = duplicate.website;
      values.domainNormalized = duplicate.domain_normalized;
    }
  }

  // Move children before soft-deleting the loser.
  const tables = [
    ["prospect_opportunities", "prospect_id"],
    ["prospect_services", "prospect_id"],
    ["prospect_notes", "prospect_id"],
    ["prospect_events", "prospect_id"],
    ["messages", "prospect_id"],
    ["replies", "prospect_id"],
    ["enrollments", "prospect_id"],
    ["prospect_tags", "prospect_id"],
  ] as const;
  for (const [table, column] of tables) {
    await db.execute(
      sql.raw(
        `update ${table} set ${column} = '${primaryId}' where ${column} = '${duplicateId}'`,
      ),
    );
  }

  await db
    .update(prospects)
    .set(values as never)
    .where(eq(prospects.id, primaryId));
  await db
    .update(prospects)
    .set({
      deletedAt: new Date(),
      isDuplicateCandidate: false,
      closedReason: `Merged into ${primary.business_name}`,
    })
    .where(eq(prospects.id, duplicateId));
  await db
    .update(prospects)
    .set({ isDuplicateCandidate: false })
    .where(eq(prospects.id, primaryId));

  await event(
    primaryId,
    "merged",
    {
      from: duplicateId,
      business: duplicate.business_name,
      fields: fieldWinners,
    },
    ctx.user.userId,
  );
  await audit(ctx, "prospect.merge", "prospect", primaryId, {
    merged: duplicateId,
  });
  return { ok: true, primaryId };
}

export async function duplicateCandidates(ctx: Ctx, id: string) {
  const p = await getProspect(ctx, id);
  if (!p.domain_normalized) return [];
  const rows = await db
    .select()
    .from(prospects)
    .where(
      and(
        eq(prospects.workspaceId, ctx.user.workspaceId),
        eq(prospects.domainNormalized, p.domain_normalized),
        ne(prospects.id, id),
        isNull(prospects.deletedAt),
      ),
    )
    .limit(5);
  return rows.map((r) => ({
    id: r.id,
    business_name: r.businessName,
    email: r.contactEmail,
  }));
}
