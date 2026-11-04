import { json, route, type RouteContext } from "@/lib/api";
import { addNote } from "@/lib/services/prospects";

type P = { id: string };

export const POST = route<P>(async (req, context: RouteContext<P>, ctx) => {
  const { id } = await context.params;
  const body = await json<{ body?: string }>(req);
  return addNote(ctx, id, body.body ?? "");
});
