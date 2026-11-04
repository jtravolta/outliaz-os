import { json, route, type RouteContext } from "@/lib/api";
import { archiveBusinessType, updateBusinessType } from "@/lib/services/settings";

type P = { id: string };

export const PATCH = route<P>(async (req, context: RouteContext<P>, ctx) => {
  const { id } = await context.params;
  const body = await json<{ label?: string }>(req);
  return updateBusinessType(ctx, id, body.label ?? "");
});

export const DELETE = route<P>(async (_req, context: RouteContext<P>, ctx) => {
  const { id } = await context.params;
  return archiveBusinessType(ctx, id);
});
