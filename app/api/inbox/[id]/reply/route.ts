import { json, route, type RouteContext } from "@/lib/api";
import { getReply, updateReply } from "@/lib/services/replies";
import { sendManualEmail } from "@/lib/services/sending";
import { AppError } from "@/lib/services/common";

type P = { id: string };

export const POST = route<P>(async (req, context: RouteContext<P>, ctx) => {
  const { id } = await context.params;
  const body = await json<{ subject?: string; body?: string }>(req);
  const { reply } = await getReply(ctx, id);

  const subject = body.subject?.trim() || `Re: ${reply.subject ?? ""}`.trim();
  const text = body.body?.trim();
  if (!text) throw new AppError("VALIDATION", "Write a reply first");
  if (!reply.prospectId) throw new AppError("VALIDATION", "Link this sender to a prospect before replying");

  const message = await sendManualEmail({
    workspaceId: ctx.user.workspaceId,
    prospectId: reply.prospectId,
    to: reply.fromEmail,
    subject,
    body: text,
    userId: ctx.user.userId,
  });

  await updateReply(ctx, id, { isRead: true });
  return { ok: true, messageId: message.id };
});
