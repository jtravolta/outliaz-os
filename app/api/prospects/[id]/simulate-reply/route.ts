import { json, route, type RouteContext } from "@/lib/api";
import { getProspect } from "@/lib/services/prospects";
import { simulateReply } from "@/lib/services/replies";

type P = { id: string };

export const POST = route<P>(async (req, context: RouteContext<P>, ctx) => {
  const { id } = await context.params;
  const body = await json<{ body?: string; unsubscribe?: boolean }>(req);
  return simulateReply(ctx, id, body.body ?? "", { unsubscribe: !!body.unsubscribe });
});
