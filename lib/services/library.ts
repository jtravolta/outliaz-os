import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  emailTemplates, offerServices, offers, qualificationRules, sequenceSteps,
} from "@/lib/db/schema";
import { renderMergeFields, markdownToHtml, wrapEmailHtml, textFromMarkdown } from "@/lib/email/render";
import type { Ctx } from "./common";
import { audit, fail } from "./common";
import { canTransition } from "@/lib/taxonomy/gates";

/* ── Offers ─────────────────────────────────────────────────────────────── */

export async function listOffers(ctx: Ctx) {
  return db
    .select({
      id: offers.id,
      name: offers.name,
      summary: offers.summary,
      valuePropMd: offers.valuePropMd,
      priceText: offers.priceText,
      constraints: offers.constraints,
      isActive: offers.isActive,
      archivedAt: offers.archivedAt,
      services: sql<string[]>`coalesce((select array_agg(os.service::text) from offer_services os where os.offer_id = ${offers.id}), '{}')`,
      templateCount: sql<number>`(select count(*)::int from email_templates t where t.offer_id = ${offers.id})`,
    })
    .from(offers)
    .where(eq(offers.workspaceId, ctx.user.workspaceId))
    .orderBy(desc(offers.createdAt));
}

export type OfferInput = {
  name: string;
  summary?: string;
  valuePropMd?: string;
  priceText?: string;
  constraints?: string;
  services?: string[];
  isActive?: boolean;
};

export async function createOffer(ctx: Ctx, input: OfferInput) {
  if (!input.name?.trim()) throw fail("VALIDATION", "Offer name is required");
  const [row] = await db
    .insert(offers)
    .values({
      workspaceId: ctx.user.workspaceId,
      name: input.name.trim().slice(0, 160),
      summary: input.summary?.trim() || null,
      valuePropMd: input.valuePropMd ?? null,
      priceText: input.priceText?.trim().slice(0, 120) || null,
      constraints: input.constraints?.trim() || null,
      isActive: input.isActive ?? true,
    })
    .returning();
  if (input.services?.length) {
    await db.insert(offerServices).values(
      [...new Set(input.services)].map((service) => ({ offerId: row.id, service: service as never })),
    );
  }
  await audit(ctx, "offer.create", "offer", row.id, { name: row.name });
  return row;
}

export async function updateOffer(ctx: Ctx, id: string, patch: Partial<OfferInput>) {
  const values: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of ["name", "summary", "valuePropMd", "priceText", "constraints", "isActive"] as const) {
    if (patch[key] !== undefined) values[key] = patch[key];
  }
  const [row] = await db
    .update(offers)
    .set(values as never)
    .where(and(eq(offers.id, id), eq(offers.workspaceId, ctx.user.workspaceId)))
    .returning();
  if (!row) throw fail("NOT_FOUND", "Offer not found", 404);
  if (patch.services) {
    await db.delete(offerServices).where(eq(offerServices.offerId, id));
    if (patch.services.length) {
      await db.insert(offerServices).values(patch.services.map((service) => ({ offerId: id, service: service as never })));
    }
  }
  await audit(ctx, "offer.update", "offer", id, { fields: Object.keys(patch) });
  return row;
}

export async function deleteOffer(ctx: Ctx, id: string) {
  const [used] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(emailTemplates)
    .where(eq(emailTemplates.offerId, id));
  if ((used?.count ?? 0) > 0) {
    throw fail("IN_USE", "This offer is used by a template. Archive it instead.", 409);
  }
  await db.delete(offers).where(and(eq(offers.id, id), eq(offers.workspaceId, ctx.user.workspaceId)));
  await audit(ctx, "offer.delete", "offer", id);
  return { ok: true };
}

/* ── Templates ──────────────────────────────────────────────────────────── */

export async function listTemplates(ctx: Ctx) {
  return db
    .select({
      id: emailTemplates.id,
      name: emailTemplates.name,
      subject: emailTemplates.subject,
      bodyMd: emailTemplates.bodyMd,
      offerId: emailTemplates.offerId,
      category: emailTemplates.category,
      archivedAt: emailTemplates.archivedAt,
      offerName: offers.name,
      usedInSteps: sql<number>`(select count(*)::int from sequence_steps s where s.template_id = ${emailTemplates.id})`,
      updatedAt: emailTemplates.updatedAt,
    })
    .from(emailTemplates)
    .leftJoin(offers, eq(offers.id, emailTemplates.offerId))
    .where(eq(emailTemplates.workspaceId, ctx.user.workspaceId))
    .orderBy(desc(emailTemplates.updatedAt));
}

export type TemplateInput = {
  name: string;
  subject: string;
  bodyMd: string;
  offerId?: string | null;
  category?: string;
};

export async function createTemplate(ctx: Ctx, input: TemplateInput) {
  validateTemplate(input);
  const [row] = await db
    .insert(emailTemplates)
    .values({
      workspaceId: ctx.user.workspaceId,
      name: input.name.trim().slice(0, 160),
      subject: input.subject.trim().slice(0, 150),
      bodyMd: input.bodyMd.slice(0, 8000),
      offerId: input.offerId || null,
      category: input.category?.slice(0, 60) || null,
    })
    .returning();
  await audit(ctx, "template.create", "template", row.id, { name: row.name });
  return row;
}

export async function updateTemplate(ctx: Ctx, id: string, patch: Partial<TemplateInput>) {
  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.name !== undefined) values.name = patch.name.trim().slice(0, 160);
  if (patch.subject !== undefined) values.subject = patch.subject.trim().slice(0, 150);
  if (patch.bodyMd !== undefined) values.bodyMd = patch.bodyMd.slice(0, 8000);
  if (patch.offerId !== undefined) values.offerId = patch.offerId || null;
  if (patch.category !== undefined) values.category = patch.category?.slice(0, 60) || null;
  const [row] = await db
    .update(emailTemplates)
    .set(values as never)
    .where(and(eq(emailTemplates.id, id), eq(emailTemplates.workspaceId, ctx.user.workspaceId)))
    .returning();
  if (!row) throw fail("NOT_FOUND", "Template not found", 404);
  await audit(ctx, "template.update", "template", id, { fields: Object.keys(patch) });
  return row;
}

export async function deleteTemplate(ctx: Ctx, id: string) {
  const [used] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sequenceSteps)
    .where(eq(sequenceSteps.templateId, id));
  if ((used?.count ?? 0) > 0) {
    throw fail("IN_USE", "This template is used in a sequence. Remove it from the sequence first.", 409);
  }
  await db.delete(emailTemplates).where(and(eq(emailTemplates.id, id), eq(emailTemplates.workspaceId, ctx.user.workspaceId)));
  await audit(ctx, "template.delete", "template", id);
  return { ok: true };
}

export function validateTemplate(input: TemplateInput) {
  if (!input.name?.trim()) throw fail("VALIDATION", "Template name is required");
  if (!input.subject?.trim()) throw fail("VALIDATION", "Subject is required");
  if ((input.subject ?? "").length > 150) throw fail("VALIDATION", "Subject must be 150 characters or fewer");
  if (!input.bodyMd?.trim()) throw fail("VALIDATION", "Body is required");
  if ((input.bodyMd ?? "").length > 8000) throw fail("VALIDATION", "Body must be 8,000 characters or fewer");
}

export const SPAM_WORDS = [
  "free", "guarantee", "risk-free", "act now", "limited time", "urgent", "winner", "$$$",
  "make money", "no obligation", "click here", "buy now",
];

export function previewTemplate(
  template: { subject: string; bodyMd: string },
  prospect: Record<string, unknown> | null,
) {
  const p = (prospect ?? {
    business_name: "Harper & Vale Dental",
    contact_first_name: "Ellie",
    contact_last_name: "Harper",
    contact_name: "Ellie Harper",
    city: "Manchester",
    region: "Greater Manchester",
    country_code: "GB",
    industry_slug: "HEALTHCARE",
    business_type_label: "Dentist",
    company_size: "SMALL",
    contact_role: "OWNER",
    website: "https://harpervale.co.uk",
  }) as never;

  const subject = renderMergeFields(template.subject, p);
  const body = renderMergeFields(template.bodyMd, p);
  const html = wrapEmailHtml(markdownToHtml(body.text), {
    footer: "Acme Studio · 12 Marlborough Place, London",
    unsubscribeUrl: "https://example.com/u/preview",
  });
  const spam = SPAM_WORDS.filter((w) => `${template.subject} ${template.bodyMd}`.toLowerCase().includes(w));
  return {
    subject: subject.text,
    body: body.text,
    html,
    text: textFromMarkdown(body.text),
    unknownFields: [...new Set([...subject.unknown, ...body.unknown])],
    spamWords: spam,
  };
}

/* ── Qualification rules ────────────────────────────────────────────────── */

export async function listRules(ctx: Ctx) {
  return db
    .select()
    .from(qualificationRules)
    .where(eq(qualificationRules.workspaceId, ctx.user.workspaceId))
    .orderBy(desc(qualificationRules.updatedAt));
}

export async function createRule(
  ctx: Ctx,
  input: { name: string; description?: string; match?: "ALL" | "ANY"; conditions?: unknown[] },
) {
  if (!input.name?.trim()) throw fail("VALIDATION", "Rule name is required");
  const [row] = await db
    .insert(qualificationRules)
    .values({
      workspaceId: ctx.user.workspaceId,
      name: input.name.trim().slice(0, 160),
      description: input.description?.trim() || null,
      match: input.match ?? "ALL",
      conditions: (input.conditions ?? []) as never,
      createdBy: ctx.user.userId,
    })
    .returning();
  await audit(ctx, "rule.create", "qualification_rule", row.id);
  return row;
}

export async function updateRule(ctx: Ctx, id: string, patch: Record<string, unknown>) {
  const values: Record<string, unknown> = { updatedAt: new Date(), revision: sql`${qualificationRules.revision} + 1` };
  for (const key of ["name", "description", "match", "conditions", "isActive"]) {
    if (patch[key] !== undefined) values[key] = patch[key];
  }
  const [row] = await db
    .update(qualificationRules)
    .set(values as never)
    .where(and(eq(qualificationRules.id, id), eq(qualificationRules.workspaceId, ctx.user.workspaceId)))
    .returning();
  if (!row) throw fail("NOT_FOUND", "Rule not found", 404);
  await audit(ctx, "rule.update", "qualification_rule", id);
  return row;
}

export async function deleteRule(ctx: Ctx, id: string) {
  await db.delete(qualificationRules).where(and(eq(qualificationRules.id, id), eq(qualificationRules.workspaceId, ctx.user.workspaceId)));
  await audit(ctx, "rule.delete", "qualification_rule", id);
  return { ok: true };
}

export const _canTransition = canTransition;
