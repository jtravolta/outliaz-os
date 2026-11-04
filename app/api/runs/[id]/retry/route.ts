import { and, eq } from "drizzle-orm";

import { route, type RouteContext } from "@/lib/api";
import { db } from "@/lib/db/client";
import { sourceRuns } from "@/lib/db/schema";
import { enqueue } from "@/lib/jobs/queue";
import { AppError } from "@/lib/services/common";

type P = { id: string };

export const POST = route<P>(async (_req, context: RouteContext<P>, ctx) => {
  const { id } = await context.params;
  const [run] = await db
    .select()
    .from(sourceRuns)
    .where(and(eq(sourceRuns.id, id), eq(sourceRuns.workspaceId, ctx.user.workspaceId)));
  if (!run) throw new AppError("NOT_FOUND", "Run not found", 404);
  if (run.status === "RUNNING" || run.status === "QUEUED") {
    throw new AppError("CONFLICT", "This run is still in progress", 409);
  }
  await db
    .update(sourceRuns)
    .set({ status: "QUEUED", startedAt: null, finishedAt: null, error: null, apifyRunId: null })
    .where(eq(sourceRuns.id, id));
  await enqueue(run.workspaceId, "APIFY_START", { runId: id }, { dedupeKey: `apify-start:${id}:retry:${Date.now()}` });
  return { ok: true };
});
