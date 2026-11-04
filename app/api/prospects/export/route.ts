import { json, route } from "@/lib/api";
import { db } from "@/lib/db/client";
import { exportJobs } from "@/lib/db/schema";
import { enqueue } from "@/lib/jobs/queue";

export const POST = route(async (req, _ctx, ctx) => {
  const filters = await json<Record<string, unknown>>(req);
  const [row] = await db
    .insert(exportJobs)
    .values({ workspaceId: ctx.user.workspaceId, filters, status: "PENDING" })
    .returning();
  await enqueue(ctx.user.workspaceId, "EXPORT", { exportId: row.id }, { dedupeKey: `export:${row.id}` });
  return { jobId: row.id };
});
