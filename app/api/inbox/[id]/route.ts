import { json, route, type RouteContext } from "@/lib/api";
import { getReply, updateReply } from "@/lib/services/replies";

type P = { id: string };

export const GET = route<P>(async (_req, context: RouteContext<P>, ctx) => {
  const { id } = await context.params;
  const row = await getReply(ctx, id);
  if (!row.reply.isRead) await updateReply(ctx, id, { isRead: true });
  return row;
});

export const PATCH = route<P>(async (req, context: RouteContext<P>, ctx) => {
  const { id } = await context.params;
  const body = await json<{ isRead?: boolean; outcome?: string | null; assignedUserId?: string | null }>(req);
  return updateReply(ctx, id, body);
});
