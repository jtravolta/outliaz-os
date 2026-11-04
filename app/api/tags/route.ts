import { and, desc, eq, sql } from "drizzle-orm";

import { route } from "@/lib/api";
import { db } from "@/lib/db/client";
import { prospectTags, tags } from "@/lib/db/schema";

export const GET = route(async (_req, _ctx, ctx) =>
  db
    .select({
      id: tags.id,
      label: tags.label,
      slug: tags.slug,
      count: sql<number>`(select count(*)::int from prospect_tags pt where pt.tag_id = ${tags.id})`,
    })
    .from(tags)
    .where(eq(tags.workspaceId, ctx.user.workspaceId))
    .orderBy(desc(tags.createdAt)),
);

export const POST = route(async (req, _ctx, ctx) => {
  const body = (await req.json().catch(() => ({}))) as { label?: string };
  const label = body.label?.trim();
  if (!label) return { ok: false };
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const [row] = await db
    .insert(tags)
    .values({ workspaceId: ctx.user.workspaceId, label, slug })
    .onConflictDoNothing()
    .returning();
  return row ?? null;
});
