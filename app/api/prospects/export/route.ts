import { json, route } from "@/lib/api";
import { db } from "@/lib/db/client";
import { jobs } from "@/lib/db/schema";

export const POST = route(async (req, _ctx, ctx) => {
  const filters = await json<Record<string, unknown>>(req);
  const [row] = await db
    .insert(jobs)
    .values({
      workspaceId: ctx.user.workspaceId,
      type: "EXPORT",
      payload: { filters },
      status: "PENDING",
    })
    .returning();
  return { jobId: row.id };
});
