import { and, eq, isNull, or, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { importBatches, leadSources, sourceRuns } from "@/lib/db/schema";
import { claimJobs, completeJob, enqueue, failJob, type JobRecord } from "./queue";
import { processApifyImport, processApifyPoll, processApifyStart } from "@/lib/services/sources";
import { processSendStep } from "@/lib/services/sending";
import { processBatchImport, exportProspects } from "@/lib/services/import-runner";
import { syncImap } from "@/lib/services/replies";
import { nextWindowStart } from "@/lib/utils";

export async function runJob(job: JobRecord): Promise<void> {
  const payload = (job.payload ?? {}) as Record<string, unknown>;
  switch (job.type) {
    case "APIFY_START":
      return processApifyStart(payload as { runId: string });
    case "APIFY_POLL":
      return processApifyPoll(payload as { runId: string; attempt?: number });
    case "APIFY_IMPORT":
      return processApifyImport(payload as { runId: string });
    case "SEND_STEP":
      return processSendStep(payload as { enrollmentId: string; force?: boolean });
    case "IMPORT_BATCH":
      return processBatchImport(payload as { batchId: string });
    case "IMAP_SYNC":
      return syncImapForWorkspace(job.workspaceId);
    case "EXPORT":
      return exportProspects({ exportId: job.id });
    case "SCHEDULE_SOURCE":
      return scheduleSources(job.workspaceId);
    default:
      throw new Error(`Unknown job type ${job.type}`);
  }
}

async function syncImapForWorkspace(workspaceId: string) {
  // Jobs have no session; attribute activity to the workspace owner.
  const [owner] = await db.execute(sql`
    select id, email, name, role, workspace_id from users
    where workspace_id = ${workspaceId} and role = 'OWNER' limit 1
  `) as unknown as { id: string; email: string; name: string; role: string; workspace_id: string }[];
  if (!owner) return;
  await syncImap({
    user: {
      userId: owner.id,
      workspaceId,
      email: owner.email,
      name: owner.name,
      role: "OWNER",
      workspaceName: "",
    },
  });
}

async function scheduleSources(workspaceId: string) {
  const rows = await db
    .select()
    .from(leadSources)
    .where(and(
      eq(leadSources.workspaceId, workspaceId),
      isNull(leadSources.archivedAt),
      or(eq(leadSources.schedule, "DAILY"), eq(leadSources.schedule, "WEEKLY")),
    ));

  for (const source of rows) {
    const intervalMs = source.schedule === "DAILY" ? 86_400_000 : 7 * 86_400_000;
    const due = !source.lastRunAt || Date.now() - source.lastRunAt.getTime() > intervalMs;
    if (!due) continue;
    const [run] = await db
      .insert(sourceRuns)
      .values({
        workspaceId,
        sourceId: source.id,
        status: "QUEUED",
        input: source.inputDefaults,
      })
      .returning();
    await enqueue(workspaceId, "APIFY_START", { runId: run.id }, { dedupeKey: `apify-start:${run.id}` });
    await db.update(leadSources).set({ lastRunAt: new Date() }).where(eq(leadSources.id, source.id));
  }
}

export async function tick(limit = 20) {
  const jobs = await claimJobs(limit);
  const results: { id: string; type: string; ok: boolean; error?: string }[] = [];
  for (const job of jobs) {
    try {
      await runJob(job);
      await completeJob(job.id);
      results.push({ id: job.id, type: job.type, ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await failJob(job, message);
      results.push({ id: job.id, type: job.type, ok: false, error: message });
    }
  }
  return { claimed: jobs.length, results };
}

/** Queue anything that should have run but was missed (cron safety net). */
export async function healthCheck(workspaceId: string) {
  const [pending] = await db.execute(sql`
    select count(*)::int as count from jobs where workspace_id = ${workspaceId} and status = 'PENDING'
  `) as unknown as { count: number }[];
  const [dead] = await db.execute(sql`
    select count(*)::int as count from jobs where workspace_id = ${workspaceId} and status = 'DEAD'
  `) as unknown as { count: number }[];
  return { pending: pending?.count ?? 0, dead: dead?.count ?? 0 };
}

export async function retryDeadJobs(workspaceId: string) {
  await db.execute(sql`
    update jobs set status = 'PENDING', run_at = ${nextWindowStart(new Date()).toISOString()}, attempts = 0
    where workspace_id = ${workspaceId} and status = 'DEAD'
  `);
}

export { enqueue, importBatches };
