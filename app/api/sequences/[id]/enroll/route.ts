import { json, route, type RouteContext } from "@/lib/api";
import { enroll } from "@/lib/services/sequences";

type P = { id: string };

export const POST = route<P>(async (req, context: RouteContext<P>, ctx) => {
  const { id } = await context.params;
  const body = await json<{ ids?: string[] }>(req);
  return enroll(ctx, id, body.ids ?? []);
});
