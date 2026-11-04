import { json, route, type RouteContext } from "@/lib/api";
import { deleteRule, updateRule } from "@/lib/services/library";

type P = { id: string };

export const PATCH = route<P>(async (req, context: RouteContext<P>, ctx) => {
  const { id } = await context.params;
  return updateRule(ctx, id, await json<Record<string, unknown>>(req));
});

export const DELETE = route<P>(async (_req, context: RouteContext<P>, ctx) => {
  const { id } = await context.params;
  return deleteRule(ctx, id);
});
