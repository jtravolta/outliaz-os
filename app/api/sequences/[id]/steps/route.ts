import { json, route, type RouteContext } from "@/lib/api";
import { getSequence, saveSteps, type StepInput } from "@/lib/services/sequences";

type P = { id: string };

export const PUT = route<P>(async (req, context: RouteContext<P>, ctx) => {
  const { id } = await context.params;
  const body = await json<{ steps?: StepInput[] }>(req);
  await saveSteps(ctx, id, body.steps ?? []);
  return getSequence(ctx, id);
});
