import { json, route, type RouteContext } from "@/lib/api";
import { deleteSequence, getSequence, updateSequence, type StepInput } from "@/lib/services/sequences";

type P = { id: string };

export const GET = route<P>(async (_req, context: RouteContext<P>, ctx) => {
  const { id } = await context.params;
  return getSequence(ctx, id);
});

export const PATCH = route<P>(async (req, context: RouteContext<P>, ctx) => {
  const { id } = await context.params;
  const body = await json<{ name?: string; description?: string; steps?: StepInput[] }>(req);
  await updateSequence(ctx, id, body);
  return getSequence(ctx, id);
});

export const DELETE = route<P>(async (_req, context: RouteContext<P>, ctx) => {
  const { id } = await context.params;
  return deleteSequence(ctx, id);
});
