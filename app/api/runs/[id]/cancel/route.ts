import { route, type RouteContext } from "@/lib/api";
import { cancelRun } from "@/lib/services/sources";

type P = { id: string };

export const POST = route<P>(async (_req, context: RouteContext<P>, ctx) => {
  const { id } = await context.params;
  return cancelRun(ctx, id);
});
