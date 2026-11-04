import { json, route, type RouteContext } from "@/lib/api";
import { getOutreachDraft, saveOutreachDraft } from "@/lib/services/prospects";

type P = { id: string };

export const GET = route<P>(async (_req, context: RouteContext<P>, ctx) => {
  const { id } = await context.params;
  return { draft: await getOutreachDraft(ctx, id) };
});

export const PUT = route<P>(async (req, context: RouteContext<P>, ctx) => {
  const { id } = await context.params;
  const body = await json<{ subject?: unknown; body?: unknown }>(req);
  return { draft: await saveOutreachDraft(ctx, id, body) };
});
