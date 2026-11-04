import { route, type RouteContext } from "@/lib/api";
import { getRun } from "@/lib/services/sources";

type P = { id: string };

export const GET = route<P>(async (_req, context: RouteContext<P>, ctx) => {
  const { id } = await context.params;
  return getRun(ctx, id);
});
