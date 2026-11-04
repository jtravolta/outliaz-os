import { json, route, type RouteContext } from "@/lib/api";
import { startRun } from "@/lib/services/sources";

type P = { id: string };

export const POST = route<P>(async (req, context: RouteContext<P>, ctx) => {
  const { id } = await context.params;
  const body = await json<{ test?: boolean }>(req);
  return startRun(ctx, id, { test: !!body.test });
});
