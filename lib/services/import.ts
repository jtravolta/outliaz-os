import { and, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { businessTypes, prospects, suppressions } from "@/lib/db/schema";
import {
  deriveSize, deriveSizeFromRange, FITS, INDUSTRIES, isRoleAddress, LABELS,
  normalizeCountry, normalizeDomain, normalizeEmail, OPPORTUNITIES, PRIORITIES,
  ROLES, SERVICES, slugify, QUALITY,
} from "@/lib/taxonomy/enums";
import type { Ctx } from "./common";
import { createProspect } from "./prospects";
import { event } from "./common";

export type ImportOptions = {
  sourceId?: string;
  sourceRunId?: string;
  sourceLabel?: string;
  defaultIndustry?: string;
  defaultMarket?: string;
  defaultOpportunity?: string;
  allowRoleAddresses?: boolean;
};

export type ImportResult = {
  imported: number;
  duplicate: number;
  invalid: number;
  qualified: number;
  skipped: { reason: string; row?: Record<string, unknown> }[];
  ids: string[];
};

const lookup = (pairs: readonly (readonly [string, string])[]) => {
  const map = new Map<string, string>();
  for (const [slug, label] of pairs) {
    map.set(slug.toLowerCase(), slug);
    map.set(label.toLowerCase(), slug);
  }
  return map;
};

const INDUSTRY_MAP = lookup(INDUSTRIES);
const OPP_MAP = lookup(OPPORTUNITIES);
const SVC_MAP = lookup(SERVICES);
const ROLE_MAP = lookup(ROLES);
const FIT_MAP = lookup(FITS);
const PRIO_MAP = lookup(PRIORITIES);
const QUALITY_MAP = lookup(QUALITY);

const listOf = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.map(String);
  if (v == null) return [];
  return String(v).split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
};

const mapEnum = (map: Map<string, string>, v: unknown) => {
  const key = String(v ?? "").trim().toLowerCase();
  return key ? map.get(key) ?? null : null;
};

const str = (v: unknown) => (v == null ? "" : String(v).trim());

export function normalizeRow(raw: Record<string, unknown>) {
  const business = str(raw.business_name ?? raw.businessName ?? raw.title ?? raw.name ?? raw.company);
  if (!business) return { error: "missing_business_name" as const };

  const emailRaw = str(raw.email ?? raw.contact_email ?? raw.contactEmail);
  const email = normalizeEmail(emailRaw);
  if (emailRaw && !email) return { error: "invalid_email" as const };

  const website = str(raw.website ?? raw.url ?? raw.domain);
  const domain = normalizeDomain(website) ?? (email ? normalizeDomain(email.split("@")[1]) : null);

  const industry =
    mapEnum(INDUSTRY_MAP, raw.industry ?? raw.industry_slug) ??
    (str(raw.industry) ? null : null);

  const employeesRaw = raw.employees ?? raw.employee_count ?? raw.employeeCount ?? raw.staff;
  const employees =
    typeof employeesRaw === "number" ? employeesRaw :
    employeesRaw ? deriveEmployeesFromString(String(employeesRaw)) : null;

  const opps = listOf(raw.opportunities ?? raw.opportunity)
    .map((o) => mapEnum(OPP_MAP, o))
    .filter((v): v is string => !!v);
  const svcs = listOf(raw.services ?? raw.service)
    .map((s) => mapEnum(SVC_MAP, s))
    .filter((v): v is string => !!v);

  const first = str(raw.contact_first_name ?? raw.firstName ?? raw.first_name);
  const last = str(raw.contact_last_name ?? raw.lastName ?? raw.last_name);
  const fullName = str(raw.contact_name ?? raw.contactName) || [first, last].filter(Boolean).join(" ");

  return {
    data: {
      business_name: business.slice(0, 200),
      website: website || undefined,
      domain_normalized: domain,
      industry: industry ?? undefined,
      business_type_label: str(raw.business_type ?? raw.businessType ?? raw.category ?? raw.type),
      employee_count: employees,
      company_size: employees ? deriveSize(employees) : "UNKNOWN",
      city: str(raw.city) || undefined,
      region: str(raw.region ?? raw.state) || undefined,
      country_code: normalizeCountry(str(raw.country_code ?? raw.country ?? raw.countryCode)) ?? undefined,
      market: str(raw.market) || undefined,
      fit: mapEnum(FIT_MAP, raw.fit) ?? "UNKNOWN",
      priority: mapEnum(PRIO_MAP, raw.priority) ?? "MEDIUM",
      contact_name: fullName || undefined,
      contact_first_name: first || undefined,
      contact_last_name: last || undefined,
      contact_role: mapEnum(ROLE_MAP, raw.role ?? raw.jobTitle ?? raw.contact_role) ?? undefined,
      contact_email: emailRaw || undefined,
      contact_phone: str(raw.phone ?? raw.contact_phone) || undefined,
      contact_quality: mapEnum(QUALITY_MAP, raw.contact_quality) ?? (email ? "UNVERIFIED" : "UNKNOWN"),
      opportunities: opps,
      services: svcs,
      tags: listOf(raw.tags),
      next_action: str(raw.next_action) || undefined,
      follow_up_date: str(raw.follow_up_date) || undefined,
      custom_fields: {},
    },
  };
}

function deriveEmployeesFromString(v: string) {
  const direct = Number(v.replace(/[^\d]/g, ""));
  if (/^\s*\d+\s*$/.test(v)) return direct;
  const derived = deriveSizeFromRange(v);
  const band: Record<string, number> = {
    SOLO: 1, MICRO: 4, SMALL: 12, SMALL_MEDIUM: 35, MEDIUM: 120, LARGE: 300, UNKNOWN: 0,
  };
  return band[derived] || direct || null;
}

export async function importRows(
  ctx: Ctx,
  rows: Record<string, unknown>[],
  opts: ImportOptions = {},
): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, duplicate: 0, invalid: 0, qualified: 0, skipped: [], ids: [] };

  const types = await db
    .select({ id: businessTypes.id, label: businessTypes.label, slug: businessTypes.slug, industry: businessTypes.industrySlug })
    .from(businessTypes);

  const emails = rows.map((r) => normalizeEmail(str(r.email ?? r.contact_email ?? r.contactEmail))).filter(Boolean) as string[];
  const [existing, deleted, supp] = await Promise.all([
    emails.length
      ? db.select({ email: prospects.contactEmailNormalized, domain: prospects.domainNormalized })
          .from(prospects)
          .where(and(eq(prospects.workspaceId, ctx.user.workspaceId), inArray(prospects.contactEmailNormalized, emails), isNull(prospects.deletedAt)))
      : Promise.resolve([]),
    emails.length
      ? db.select({ email: prospects.contactEmailNormalized }).from(prospects)
          .where(and(eq(prospects.workspaceId, ctx.user.workspaceId), inArray(prospects.contactEmailNormalized, emails)))
      : Promise.resolve([]),
    emails.length
      ? db.select({ email: suppressions.emailNormalized }).from(suppressions)
          .where(and(eq(suppressions.workspaceId, ctx.user.workspaceId), inArray(suppressions.emailNormalized, emails)))
      : Promise.resolve([]),
  ]);

  const seen = new Set(existing.map((e) => e.email).filter(Boolean) as string[]);
  const knownDomains = new Set(existing.map((e) => e.domain).filter(Boolean) as string[]);
  const suppressed = new Set(supp.map((s) => s.email));

  for (const [index, raw] of rows.entries()) {
    const normalized = normalizeRow(raw);
    if ("error" in normalized) {
      result.invalid++;
      result.skipped.push({ reason: normalized.error!, row: raw });
      continue;
    }
    const d = normalized.data;

    if (d.contact_email && !opts.allowRoleAddresses && isRoleAddress(d.contact_email)) {
      result.invalid++;
      result.skipped.push({ reason: "role_address", row: raw });
      continue;
    }
    if (d.contact_email && seen.has(d.contact_email)) {
      result.duplicate++;
      result.skipped.push({ reason: "duplicate_email", row: raw });
      continue;
    }
    if (d.contact_email && suppressed.has(d.contact_email)) {
      result.invalid++;
      result.skipped.push({ reason: "suppressed", row: raw });
      continue;
    }

    // Resolve business type by label within the industry (or any industry).
    let businessTypeId: string | undefined;
    const industry = d.industry ?? opts.defaultIndustry;
    if (d.business_type_label) {
      const wanted = slugify(d.business_type_label);
      const match = types.find(
        (t) => t.slug === wanted && (!industry || t.industry === industry),
      ) ?? types.find((t) => t.slug === wanted);
      businessTypeId = match?.id;
    }

    const isDuplicateCandidate =
      !!d.domain_normalized && !knownDomains.has(d.domain_normalized) && knownDomains.size > 0
        ? [...knownDomains].some((dom) => dom === d.domain_normalized)
        : false;

    try {
      const created = await createProspect(
        ctx,
        {
          business_name: d.business_name,
          website: d.website,
          industry,
          business_type_id: businessTypeId,
          employee_count: d.employee_count ?? undefined,
          company_size: d.company_size,
          city: d.city,
          region: d.region,
          country_code: d.country_code,
          market: d.market ?? opts.defaultMarket,
          fit: d.fit,
          priority: d.priority,
          contact_name: d.contact_name,
          contact_first_name: d.contact_first_name,
          contact_last_name: d.contact_last_name,
          contact_role: d.contact_role,
          contact_email: d.contact_email,
          contact_phone: d.contact_phone,
          contact_quality: d.contact_quality,
          opportunities: d.opportunities.length ? d.opportunities : opts.defaultOpportunity ? [opts.defaultOpportunity] : ["UNKNOWN"],
          services: d.services,
          tags: d.tags,
          next_action: d.next_action,
          follow_up_date: d.follow_up_date,
          source_id: opts.sourceId,
          source_run_id: opts.sourceRunId,
          source_label: opts.sourceLabel,
        },
        { silent: true },
      );

      if (d.contact_email) seen.add(d.contact_email);
      if (d.domain_normalized) knownDomains.add(d.domain_normalized);
      if (isDuplicateCandidate) {
        await db.update(prospects).set({ isDuplicateCandidate: true }).where(eq(prospects.id, created.id));
      }
      await event(created.id, "imported", { index, source: opts.sourceLabel ?? "import", run: opts.sourceRunId }, ctx.user.userId);

      result.imported++;
      result.ids.push(created.id);
      if (d.fit === "STRONG" || d.fit === "GOOD") result.qualified++;
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "23505") {
        result.duplicate++;
        result.skipped.push({ reason: "duplicate_email", row: raw });
      } else {
        result.invalid++;
        result.skipped.push({ reason: err instanceof Error ? err.message : "insert_failed", row: raw });
      }
    }
  }

  return result;
}

/** Map a CSV header to a taxonomy field (used by the import wizard). */
export function guessMapping(headers: string[]): Record<string, string> {
  const guesses: Record<string, string[]> = {
    business_name: ["business", "company", "name", "business name", "organisation", "organization"],
    website: ["website", "url", "domain", "site", "web"],
    email: ["email", "e-mail", "contact email", "mail", "address"],
    contact_name: ["contact", "contact name", "full name", "person"],
    contact_first_name: ["first name", "firstname", "given name"],
    contact_last_name: ["last name", "lastname", "surname", "family name"],
    phone: ["phone", "telephone", "mobile", "tel"],
    city: ["city", "town", "locality"],
    region: ["region", "state", "county", "province"],
    country: ["country", "country code"],
    industry: ["industry", "sector", "vertical"],
    business_type: ["business type", "type", "category", "subcategory"],
    employees: ["employees", "employee count", "staff", "headcount", "size", "company size"],
    opportunities: ["opportunity", "opportunities", "needs", "pain"],
    services: ["service", "services", "offering"],
    role: ["role", "job title", "title", "position"],
    tags: ["tags", "labels"],
    market: ["market", "region market"],
    next_action: ["next action", "next step"],
    follow_up_date: ["follow up", "follow-up date", "followup", "due"],
  };
  const out: Record<string, string> = {};
  for (const h of headers) {
    const norm = h.trim().toLowerCase();
    for (const [field, aliases] of Object.entries(guesses)) {
      if (aliases.includes(norm)) out[h] = field;
    }
  }
  return out;
}

export function applyMapping(rows: string[][], mapping: Record<string, string>) {
  const [header, ...body] = rows;
  return body.map((cells) => {
    const obj: Record<string, unknown> = {};
    header.forEach((h, i) => {
      const field = mapping[h];
      if (field && field !== "__ignore__") obj[field] = cells[i];
    });
    return obj;
  });
}
