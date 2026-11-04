import { json, route, type RouteContext } from "@/lib/api";
import { mergeProspects } from "@/lib/services/prospects";

type P = { id: string };

export const POST = route<P>(async (req, context: RouteContext<P>, ctx) => {
  const { id } = await context.params;
  const body = await json<{ duplicateId?: string; fieldWinners?: Record<string, "primary" | "duplicate"> }>(req);
  return mergeProspects(ctx, id, body.duplicateId ?? "", body.fieldWinners);
});
