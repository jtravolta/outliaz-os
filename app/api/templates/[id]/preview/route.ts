import { json, route, type RouteContext } from "@/lib/api";
import { previewTemplate } from "@/lib/services/library";
import { getProspect } from "@/lib/services/prospects";
import { db } from "@/lib/db/client";
import { emailTemplates } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

type P = { id: string };

export const POST = route<P>(async (req, context: RouteContext<P>, ctx) => {
  const { id } = await context.params;
  const body = await json<{ prospectId?: string; subject?: string; bodyMd?: string }>(req);

  const [template] = await db
    .select()
    .from(emailTemplates)
    .where(and(eq(emailTemplates.id, id), eq(emailTemplates.workspaceId, ctx.user.workspaceId)));
  if (!template) throw new Error("Template not found");

  let prospect: Record<string, unknown> | null = null;
  if (body.prospectId) {
    const p = await getProspect(ctx, body.prospectId).catch(() => null);
    if (p) prospect = p as unknown as Record<string, unknown>;
  }
  return previewTemplate(
    {
      subject: body.subject ?? template.subject,
      bodyMd: body.bodyMd ?? template.bodyMd,
    },
    prospect,
  );
});
