import type { NextRequest } from "next/server";
import { json, qBool, qList, qNum, q, route } from "@/lib/api";
import {
  createProspect, listProspects, suggestServices, type ProspectFilters,
} from "@/lib/services/prospects";

const filters = (req: NextRequest): ProspectFilters => ({
  q: q(req, "q"),
  stages: qList(req, "stage"),
  industry: q(req, "industry"),
  businessTypeId: q(req, "businessTypeId") ?? q(req, "business_type_id"),
  size: q(req, "size"),
  country: q(req, "country"),
  region: q(req, "region"),
  city: q(req, "city"),
  market: q(req, "market"),
  opportunities: qList(req, "opportunity"),
  services: qList(req, "service"),
  fit: q(req, "fit"),
  priority: q(req, "priority"),
  quality: q(req, "quality"),
  contactability: q(req, "contactability"),
  hasEmail: qBool(req, "hasEmail"),
  gate: (q(req, "gate") as ProspectFilters["gate"]) ?? undefined,
  ownerId: q(req, "ownerId") ?? q(req, "owner"),
  tag: q(req, "tag"),
  followUp: (q(req, "followUp") ?? q(req, "follow_up_due")) as ProspectFilters["followUp"],
  sort: (q(req, "sort") as ProspectFilters["sort"]) ?? "newest",
  page: qNum(req, "page"),
  pageSize: qNum(req, "pageSize"),
});

export const GET = route(async (req, _ctx, ctx) => {
  const result = await listProspects(ctx, filters(req));
  return {
    ...result,
    rows: result.rows.map((p) => ({
      ...p,
      suggested_services: suggestServices(p),
    })),
  };
});

export const POST = route(async (req, _ctx, ctx) => {
  const body = await json<Record<string, unknown>>(req);
  return createProspect(ctx, body as never);
});
