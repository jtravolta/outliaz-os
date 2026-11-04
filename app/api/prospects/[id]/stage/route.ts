import { json, route, type RouteContext } from "@/lib/api";
import { getProspectDetail, transitionProspect } from "@/lib/services/prospects";

type P = { id: string };

export const POST = route<P>(async (req, context: RouteContext<P>, ctx) => {
  const { id } = await context.params;
  const body = await json<{ to?: string; reason?: string; override?: boolean }>(req);
  await transitionProspect(ctx, id, body.to ?? "", { reason: body.reason, override: body.override });
  return getProspectDetail(ctx, id);
});
