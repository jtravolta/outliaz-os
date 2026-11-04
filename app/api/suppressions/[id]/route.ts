import { route, type RouteContext } from "@/lib/api";
import { deleteSuppression } from "@/lib/services/settings";

type P = { id: string };

export const DELETE = route<P>(async (_req, context: RouteContext<P>, ctx) => {
  const { id } = await context.params;
  return deleteSuppression(ctx, id);
});
