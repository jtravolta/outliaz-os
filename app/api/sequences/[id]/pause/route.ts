import { route, type RouteContext } from "@/lib/api";
import { getSequence, setSequenceStatus } from "@/lib/services/sequences";

type P = { id: string };

export const POST = route<P>(async (_req, context: RouteContext<P>, ctx) => {
  const { id } = await context.params;
  await setSequenceStatus(ctx, id, "PAUSED");
  return getSequence(ctx, id);
});
