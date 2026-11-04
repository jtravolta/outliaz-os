import { json, route } from "@/lib/api";
import { createRule, listRules } from "@/lib/services/library";

export const GET = route(async (_req, _ctx, ctx) => listRules(ctx));

export const POST = route(async (req, _ctx, ctx) => {
  const body = await json<{ name?: string; description?: string; match?: "ALL" | "ANY"; conditions?: unknown[] }>(req);
  return createRule(ctx, { name: body.name ?? "", description: body.description, match: body.match, conditions: body.conditions });
});
