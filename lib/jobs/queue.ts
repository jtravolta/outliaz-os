import { and, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { jobs } from "@/lib/db/schema";
import type { JOB_TYPES } from "@/lib/taxonomy/enums";

export type JobType = (typeof JOB_TYPES)[number];

export type JobRecord = typeof jobs.$inferSelect;

export async function enqueue(
  workspaceId: string,
  type: JobType,
  payload: Record<string, unknown> = {},
  opts: { runAt?: Date; dedupeKey?: string; maxAttempts?: number } = {},
) {
  const [row] = await db
    .insert(jobs)
    .values({
      workspaceId,
      type,
      payload,
      runAt: opts.runAt ?? new Date(),
      dedupeKey: opts.dedupeKey,
      maxAttempts: opts.maxAttempts ?? 5,
    })
    .onConflictDoNothing()
    .returning();
  return row ?? null;
}

export async function claimJobs(limit = 20, workerId = `local-${process.pid}`): Promise<JobRecord[]> {
  const rows = (await db.execute(sql`
    with due as (
      select id from jobs
      where status = 'PENDING' and run_at <= now()
      order by run_at asc
      limit ${limit}
      for update skip locked
    )
    update jobs j
    set status = 'CLAIMED', locked_at = now(), locked_by = ${workerId}, attempts = j.attempts + 1
    where j.id in (select id from due)
    returning j.*
  `)) as unknown as Array<Record<string, unknown>>;

  const toJob = (r: Record<string, unknown>): JobRecord => ({
    id: String(r.id ?? ""),
    workspaceId: String(r.workspace_id ?? r.workspaceId ?? ""),
    type: String(r.type ?? ""),
    payload: (r.payload as Record<string, unknown>) ?? {},
    status: String(r.status ?? "PENDING"),
    runAt: r.run_at ? new Date(String(r.run_at)) : new Date(),
    attempts: Number(r.attempts ?? 0),
    maxAttempts: Number(r.max_attempts ?? r.maxAttempts ?? 5),
    lockedAt: r.locked_at ? new Date(String(r.locked_at)) : null,
    lockedBy: (r.locked_by as string) ?? null,
    lastError: (r.last_error as string) ?? null,
    dedupeKey: (r.dedupe_key as string) ?? null,
    createdAt: r.created_at ? new Date(String(r.created_at)) : new Date(),
    updatedAt: r.updated_at ? new Date(String(r.updated_at)) : new Date(),
  });

  return rows.map(toJob);
}

export async function completeJob(id: string) {
  await db.update(jobs).set({ status: "DONE", lastError: null }).where(eq(jobs.id, id));
}

export async function failJob(job: JobRecord, error: string) {
  const dead = job.attempts >= job.maxAttempts;
  const delayMs = Math.pow(2, job.attempts) * 60_000;
  await db
    .update(jobs)
    .set({
      status: dead ? "DEAD" : "PENDING",
      lastError: error.slice(0, 2000),
      runAt: new Date(Date.now() + delayMs),
      lockedAt: null,
      lockedBy: null,
    })
    .where(eq(jobs.id, job.id));
}

export async function retryJob(id: string) {
  await db
    .update(jobs)
    .set({ status: "PENDING", runAt: new Date(), attempts: 0, lastError: null })
    .where(eq(jobs.id, id));
}

export async function pendingCount(workspaceId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobs)
    .where(and(eq(jobs.workspaceId, workspaceId), eq(jobs.status, "PENDING")));
  return row?.count ?? 0;
}
