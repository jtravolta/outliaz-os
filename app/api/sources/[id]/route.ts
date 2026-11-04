import { json, route, type RouteContext } from "@/lib/api";
import { archiveSource, getSource, updateSource } from "@/lib/services/sources";

type P = { id: string };

export const GET = route<P>(async (_req, context: RouteContext<P>, ctx) => {
  const { id } = await context.params;
  return getSource(ctx, id);
});

export const PATCH = route<P>(async (req, context: RouteContext<P>, ctx) => {
  const { id } = await context.params;
  const body = await json<Record<string, unknown>>(req);
  return updateSource(ctx, id, body as never);
});

export const DELETE = route<P>(async (_req, context: RouteContext<P>, ctx) => {
  const { id } = await context.params;
  return archiveSource(ctx, id);
});
