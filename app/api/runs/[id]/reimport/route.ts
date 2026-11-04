import { and, eq } from "drizzle-orm";

import { route, type RouteContext } from "@/lib/api";
import { db } from "@/lib/db/client";
import { sourceRuns } from "@/lib/db/schema";
import { enqueue } from "@/lib/jobs/queue";
import { AppError } from "@/lib/services/common";

type P = { id: string };

/** Re-import the dataset of a completed run (new rows only survive dedupe). */
export const POST = route<P>(async (_req, context: RouteContext<P>, ctx) => {
  const { id } = await context.params;
  const [run] = await db
    .select()
    .from(sourceRuns)
    .where(and(eq(sourceRuns.id, id), eq(sourceRuns.workspaceId, ctx.user.workspaceId)));
  if (!run) throw new AppError("NOT_FOUND", "Run not found", 404);
  if (!run.apifyRunId) throw new AppError("CONFLICT", "This run has no dataset to import", 409);

  await enqueue(run.workspaceId, "APIFY_IMPORT", { runId: id }, {
    dedupeKey: `apify-import:${id}:${Date.now()}`,
  });
  return { ok: true };
});
