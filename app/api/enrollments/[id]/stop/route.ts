import { json, route, type RouteContext } from "@/lib/api";
import { stopEnrollment } from "@/lib/services/sequences";

type P = { id: string };

export const POST = route<P>(async (req, context: RouteContext<P>, ctx) => {
  const { id } = await context.params;
  const body = await json<{ reason?: string }>(req);
  return stopEnrollment(ctx, id, body.reason ?? "manual");
});
