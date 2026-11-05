import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { getPrismaClient, type createPrismaClient } from "@/lib/db/prisma";
import {
  auditLogs,
  businessTypes,
  industries,
  integrationCredentials,
  prospects,
  suppressions,
  users,
  workspaces,
} from "@/lib/db/schema";
import { providers } from "@/lib/providers";
import type { Ctx } from "./common";
import { audit, fail, requireRole } from "./common";
import {
  BUSINESS_TYPES,
  INDUSTRIES,
  LABELS,
  OPPORTUNITIES,
  PRIORITIES,
  SERVICES,
  SIZES,
  STAGES,
  FITS,
  normalizeEmail,
  slugify,
} from "@/lib/taxonomy/enums";

/* ── workspace ──────────────────────────────────────────────────────────── */

export async function getWorkspace(
  ctx: Ctx,
  prisma: ReturnType<typeof createPrismaClient> = getPrismaClient(),
) {
  const row = await prisma.workspaces.findUnique({
    where: { id: ctx.user.workspaceId },
  });
  if (!row) throw fail("NOT_FOUND", "Workspace not found", 404);
  return {
    id: row.id,
    name: row.name,
    timezone: row.timezone,
    sendWindowStart: row.send_window_start.toISOString().slice(11, 16),
    sendWindowEnd: row.send_window_end.toISOString().slice(11, 16),
    dailySendCap: row.daily_send_cap,
    hourlySendCap: row.hourly_send_cap,
    trackOpens: row.track_opens,
    trackClicks: row.track_clicks,
    unsubscribeFooter: Boolean(row.unsubscribe_footer),
    footerText: row.unsubscribe_footer,
    setupCompletedAt: row.setup_completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function updateWorkspace(
  ctx: Ctx,
  patch: Record<string, unknown>,
) {
  requireRole(ctx, ["OWNER", "ADMIN"]);
  const allowed = [
    "name",
    "timezone",
    "sendWindowStart",
    "sendWindowEnd",
    "dailySendCap",
    "hourlySendCap",
    "trackOpens",
    "trackClicks",
    "unsubscribeFooter",
    "footerText",
  ];
  const values: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of allowed) {
    if (patch[key] !== undefined) values[key] = patch[key];
  }
  if (
    values.sendWindowStart &&
    !/^\d{2}:\d{2}$/.test(String(values.sendWindowStart))
  ) {
    throw fail("VALIDATION", "Send window start must be HH:mm");
  }
  if (
    values.sendWindowEnd &&
    !/^\d{2}:\d{2}$/.test(String(values.sendWindowEnd))
  ) {
    throw fail("VALIDATION", "Send window end must be HH:mm");
  }
  if (
    values.sendWindowStart &&
    values.sendWindowEnd &&
    String(values.sendWindowEnd) <= String(values.sendWindowStart)
  ) {
    throw fail("VALIDATION", "Send window must end after it starts");
  }
  const [row] = await db
    .update(workspaces)
    .set(values as never)
    .where(eq(workspaces.id, ctx.user.workspaceId))
    .returning();
  await audit(ctx, "workspace.update", "workspace", row.id, {
    fields: Object.keys(patch),
  });
  return row;
}

/* ── encryption ─────────────────────────────────────────────────────────── */

const key = () =>
  createHash("sha256")
    .update(
      process.env.APP_ENCRYPTION_KEY ??
        "dev-only-insecure-key-please-change-me",
    )
    .digest();

export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  return {
    secretCiphertext: ciphertext.toString("base64"),
    secretIv: iv.toString("base64"),
    secretTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptSecret(row: {
  secretCiphertext: string | null;
  secretIv: string | null;
  secretTag: string | null;
}) {
  if (!row.secretCiphertext || !row.secretIv || !row.secretTag) return "";
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key(),
      Buffer.from(row.secretIv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(row.secretTag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(row.secretCiphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return "";
  }
}

const mask = (row: { secretCiphertext: string | null }) =>
  row.secretCiphertext ? `••••${row.secretCiphertext.slice(-4) || "0000"}` : "";

const maskBytes = (secret: Uint8Array | null) =>
  secret
    ? `••••${Buffer.from(secret).toString("hex").slice(-4) || "0000"}`
    : "";

/* ── integrations ───────────────────────────────────────────────────────── */

export async function listIntegrations(
  ctx: Ctx,
  prisma: ReturnType<typeof createPrismaClient> = getPrismaClient(),
) {
  const rows = await prisma.integration_credentials.findMany({
    where: { workspace_id: ctx.user.workspaceId },
  });

  const kinds: ("APIFY" | "RESEND" | "IMAP")[] = ["APIFY", "RESEND", "IMAP"];
  return kinds.map((kind) => {
    const row = rows.find((r) => r.kind === kind);
    const active =
      kind === "APIFY"
        ? providers.apify
        : kind === "RESEND"
          ? providers.resend
          : providers.imap;
    return {
      kind,
      label: row?.label ?? null,
      config: row?.config ?? {},
      secretMasked: row ? maskBytes(row.secret_ciphertext) : "",
      verifiedAt: row?.verified_at ?? null,
      lastError: row?.last_error ?? null,
      mode: active.mode,
      configured: !!row,
    };
  });
}

export async function saveIntegration(
  ctx: Ctx,
  kind: "APIFY" | "RESEND" | "IMAP",
  input: { label?: string; config?: Record<string, unknown>; secret?: string },
) {
  requireRole(ctx, ["OWNER", "ADMIN"]);
  const existing = await db
    .select()
    .from(integrationCredentials)
    .where(
      and(
        eq(integrationCredentials.workspaceId, ctx.user.workspaceId),
        eq(integrationCredentials.kind, kind),
      ),
    );

  const secret = encryptSecret(input.secret ?? "");
  const values = {
    workspaceId: ctx.user.workspaceId,
    kind,
    label: input.label ?? null,
    config: input.config ?? {},
    ...(input.secret ? secret : {}),
    verifiedAt: new Date(),
    lastError: null,
    updatedAt: new Date(),
  };

  const [row] = existing.length
    ? await db
        .update(integrationCredentials)
        .set(values as never)
        .where(eq(integrationCredentials.id, existing[0].id))
        .returning()
    : await db
        .insert(integrationCredentials)
        .values(values as never)
        .returning();

  await audit(ctx, "integration.save", "integration", row.id, {
    kind,
    label: row.label,
  });
  return { ...row, secretMasked: mask(row) };
}

export async function testIntegration(
  ctx: Ctx,
  kind: "APIFY" | "RESEND" | "IMAP",
) {
  requireRole(ctx, ["OWNER", "ADMIN"]);
  const provider =
    kind === "APIFY"
      ? providers.apify
      : kind === "RESEND"
        ? providers.resend
        : providers.imap;
  let result: { ok: boolean; message: string };
  if (kind === "RESEND") {
    const [row] = await db
      .select()
      .from(integrationCredentials)
      .where(
        and(
          eq(integrationCredentials.workspaceId, ctx.user.workspaceId),
          eq(integrationCredentials.kind, "RESEND"),
        ),
      );
    const domain = String(
      row?.config?.domain ??
        process.env.RESEND_FROM_EMAIL?.split("@")[1] ??
        "example.com",
    );
    const resend = await providers.resend;
    result = await resend.verifyDomain(domain);
  } else {
    const provider = kind === "APIFY" ? providers.apify : providers.imap;
    result = await provider.testConnection();
  }

  await db
    .update(integrationCredentials)
    .set({
      verifiedAt: result.ok ? new Date() : null,
      lastError: result.ok ? null : result.message,
    })
    .where(
      and(
        eq(integrationCredentials.workspaceId, ctx.user.workspaceId),
        eq(integrationCredentials.kind, kind),
      ),
    );

  return {
    ...result,
    mode:
      kind === "APIFY"
        ? providers.apify.mode
        : kind === "RESEND"
          ? providers.resend.mode
          : providers.imap.mode,
  };
}

export async function deleteIntegration(
  ctx: Ctx,
  kind: "APIFY" | "RESEND" | "IMAP",
) {
  requireRole(ctx, ["OWNER", "ADMIN"]);
  await db
    .delete(integrationCredentials)
    .where(
      and(
        eq(integrationCredentials.workspaceId, ctx.user.workspaceId),
        eq(integrationCredentials.kind, kind),
      ),
    );
  await audit(ctx, "integration.delete", "integration", undefined, { kind });
  return { ok: true };
}

/* ── taxonomy ───────────────────────────────────────────────────────────── */

export async function getTaxonomy(ctx: Ctx) {
  const ws = ctx.user.workspaceId;
  const [types, industryUsage, totalProspectsRow] = await Promise.all([
    db
      .select({
        id: businessTypes.id,
        industrySlug: businessTypes.industrySlug,
        label: businessTypes.label,
        slug: businessTypes.slug,
        isSystem: businessTypes.isSystem,
        archivedAt: businessTypes.archivedAt,
        usage: sql<number>`(select count(*)::int from prospects p where p.business_type_id = ${businessTypes.id})`,
      })
      .from(businessTypes)
      .where(sql`${businessTypes.archivedAt} is null`)
      .orderBy(businessTypes.label),
    db
      .select({
        industry: prospects.industrySlug,
        count: sql<number>`count(*)::int`,
      })
      .from(prospects)
      .where(
        and(eq(prospects.workspaceId, ws), sql`${prospects.deletedAt} is null`),
      )
      .groupBy(prospects.industrySlug),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(prospects)
      .where(eq(prospects.workspaceId, ws)),
  ]);

  const totalProspects = totalProspectsRow?.[0]?.count ?? 0;

  return {
    industries: INDUSTRIES.map(([slug, label]) => ({
      slug,
      label,
      usage: industryUsage.find((c) => c.industry === slug)?.count ?? 0,
      suggestedTypes: BUSINESS_TYPES[slug] ?? [],
    })),
    businessTypes: types,
    enums: {
      sizes: SIZES,
      opportunities: OPPORTUNITIES,
      services: SERVICES,
      fits: FITS,
      priorities: PRIORITIES,
      stages: STAGES,
      labels: LABELS,
    },
    totalProspects,
  };
}

export async function createBusinessType(
  ctx: Ctx,
  input: { industrySlug: string; label: string },
) {
  requireRole(ctx, ["OWNER", "ADMIN"]);
  if (!input.label?.trim()) throw fail("VALIDATION", "Label is required");
  if (!INDUSTRIES.some(([slug]) => slug === input.industrySlug)) {
    throw fail("VALIDATION", "Unknown industry");
  }
  const [row] = await db
    .insert(businessTypes)
    .values({
      industrySlug: input.industrySlug,
      label: input.label.trim().slice(0, 100),
      slug: slugify(input.label).slice(0, 100),
      isSystem: false,
    })
    .returning();
  await audit(ctx, "taxonomy.business_type.create", "business_type", row.id, {
    label: row.label,
  });
  return row;
}

export async function updateBusinessType(ctx: Ctx, id: string, label: string) {
  requireRole(ctx, ["OWNER", "ADMIN"]);
  if (!label?.trim()) throw fail("VALIDATION", "Label is required");
  const [row] = await db
    .update(businessTypes)
    .set({ label: label.trim().slice(0, 100) })
    .where(eq(businessTypes.id, id))
    .returning();
  if (!row) throw fail("NOT_FOUND", "Business type not found", 404);
  await audit(ctx, "taxonomy.business_type.update", "business_type", id, {
    label,
  });
  return row;
}

export async function archiveBusinessType(ctx: Ctx, id: string) {
  requireRole(ctx, ["OWNER", "ADMIN"]);
  const [used] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(prospects)
    .where(eq(prospects.businessTypeId, id));
  if ((used?.count ?? 0) > 0) {
    throw fail(
      "IN_USE",
      `${used.count} prospects use this type. Reassign them before archiving.`,
      409,
      { usage: used.count },
    );
  }
  await db
    .update(businessTypes)
    .set({ archivedAt: new Date() })
    .where(eq(businessTypes.id, id));
  await audit(ctx, "taxonomy.business_type.archive", "business_type", id);
  return { ok: true };
}

/* ── team ───────────────────────────────────────────────────────────────── */

export async function listTeam(ctx: Ctx) {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      status: users.status,
      createdAt: users.createdAt,
      sent: sql<number>`(select count(*)::int from messages m where m.from_email = ${users.email} and m.sent_at is not null)`,
    })
    .from(users)
    .where(eq(users.workspaceId, ctx.user.workspaceId))
    .orderBy(users.name);
}

export async function inviteUser(
  ctx: Ctx,
  input: { email: string; name?: string; role?: string },
) {
  requireRole(ctx, ["OWNER"]);
  const email = normalizeEmail(input.email);
  if (!email) throw fail("VALIDATION", "Enter a valid email");
  const [row] = await db
    .insert(users)
    .values({
      workspaceId: ctx.user.workspaceId,
      email,
      name: input.name?.trim().slice(0, 120) || email.split("@")[0],
      role: (input.role as never) ?? "MEMBER",
      status: "INVITED",
    })
    .returning();
  await audit(ctx, "team.invite", "user", row.id, { email, role: row.role });
  return row;
}

export async function updateUser(
  ctx: Ctx,
  id: string,
  patch: { role?: string; status?: string; name?: string },
) {
  requireRole(ctx, ["OWNER"]);
  if (id === ctx.user.userId && patch.role && patch.role !== "OWNER") {
    throw fail("VALIDATION", "You cannot demote yourself");
  }
  const values: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of ["role", "status", "name"])
    if (patch[key as keyof typeof patch] !== undefined)
      values[key] = patch[key as keyof typeof patch];
  const [row] = await db
    .update(users)
    .set(values as never)
    .where(and(eq(users.id, id), eq(users.workspaceId, ctx.user.workspaceId)))
    .returning();
  if (!row) throw fail("NOT_FOUND", "User not found", 404);
  await audit(ctx, "team.update", "user", id, patch);
  return row;
}

export async function removeUser(ctx: Ctx, id: string) {
  requireRole(ctx, ["OWNER"]);
  if (id === ctx.user.userId)
    throw fail("VALIDATION", "You cannot remove yourself");
  await db
    .update(users)
    .set({
      status: "DISABLED",
      sessionVersion: sql`${users.sessionVersion} + 1`,
    })
    .where(and(eq(users.id, id), eq(users.workspaceId, ctx.user.workspaceId)));
  await audit(ctx, "team.disable", "user", id);
  return { ok: true };
}

/* ── suppression ────────────────────────────────────────────────────────── */

export async function listSuppressions(ctx: Ctx, query?: string) {
  const parts = [eq(suppressions.workspaceId, ctx.user.workspaceId)];
  if (query)
    parts.push(
      or(
        ilike(suppressions.emailNormalized, `%${query}%`),
        ilike(suppressions.note, `%${query}%`),
      )!,
    );
  return db
    .select()
    .from(suppressions)
    .where(and(...parts))
    .orderBy(desc(suppressions.createdAt))
    .limit(500);
}

export async function addSuppressions(
  ctx: Ctx,
  input: { emails: string[]; reason?: string; note?: string },
) {
  requireRole(ctx, ["OWNER", "ADMIN"]);
  const emails = input.emails
    .map((e) => normalizeEmail(e))
    .filter(Boolean) as string[];
  if (!emails.length) throw fail("VALIDATION", "Add at least one valid email");
  let added = 0;
  for (const email of [...new Set(emails)]) {
    const [row] = await db
      .insert(suppressions)
      .values({
        workspaceId: ctx.user.workspaceId,
        emailNormalized: email,
        reason: (input.reason as never) ?? "MANUAL",
        source: "manual",
        note: input.note?.slice(0, 500) || null,
        createdBy: ctx.user.userId,
      })
      .onConflictDoNothing()
      .returning();
    if (row) {
      added++;
      await db
        .update(prospects)
        .set({ contactability: "DO_NOT_CONTACT" })
        .where(
          and(
            eq(prospects.workspaceId, ctx.user.workspaceId),
            eq(prospects.contactEmailNormalized, email),
          ),
        );
    }
  }
  await audit(ctx, "suppression.add", "suppression", undefined, {
    count: added,
    reason: input.reason,
  });
  return { added, skipped: emails.length - added };
}

export async function deleteSuppression(ctx: Ctx, id: string) {
  requireRole(ctx, ["OWNER", "ADMIN"]);
  await db
    .delete(suppressions)
    .where(
      and(
        eq(suppressions.id, id),
        eq(suppressions.workspaceId, ctx.user.workspaceId),
      ),
    );
  await audit(ctx, "suppression.delete", "suppression", id);
  return { ok: true };
}

/* ── audit ──────────────────────────────────────────────────────────────── */

export async function listAudit(
  ctx: Ctx,
  filters: { action?: string; userId?: string; page?: number } = {},
) {
  requireRole(ctx, ["OWNER", "ADMIN"]);
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = 40;
  const parts = [eq(auditLogs.workspaceId, ctx.user.workspaceId)];
  if (filters.action)
    parts.push(ilike(auditLogs.action, `%${filters.action}%`));
  if (filters.userId) parts.push(eq(auditLogs.userId, filters.userId));
  const [rows, count] = await Promise.all([
    db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        targetType: auditLogs.targetType,
        targetId: auditLogs.targetId,
        meta: auditLogs.meta,
        createdAt: auditLogs.createdAt,
        userName: users.name,
      })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.userId))
      .where(and(...parts))
      .orderBy(desc(auditLogs.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(and(...parts)),
  ]);
  return { rows, total: count[0]?.count ?? 0, page, pageSize };
}
