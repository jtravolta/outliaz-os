import { json, route, type RouteContext } from "@/lib/api";
import { removeUser, updateUser } from "@/lib/services/settings";

type P = { id: string };

export const PATCH = route<P>(async (req, context: RouteContext<P>, ctx) => {
  const { id } = await context.params;
  const body = await json<{ role?: string; status?: string; name?: string }>(req);
  return updateUser(ctx, id, body);
});

export const DELETE = route<P>(async (_req, context: RouteContext<P>, ctx) => {
  const { id } = await context.params;
  return removeUser(ctx, id);
});
