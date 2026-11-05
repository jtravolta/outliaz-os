import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { leadSources, sourceRuns } from "@/lib/db/schema";
import { providers } from "@/lib/providers";
import type { Ctx } from "./common";
import { audit, fail } from "./common";
import { importRows } from "./import";
import { enqueue } from "@/lib/jobs/queue";

export async function listSources(ctx: Ctx) {
  const rows = await db
    .select({
      id: leadSources.id, name: leadSources.name, description: leadSources.description,
      actorId: leadSources.actorId, actorName: leadSources.actorName, schedule: leadSources.schedule,
      lastRunAt: leadSources.lastRunAt, createdAt: leadSources.createdAt, archivedAt: leadSources.archivedAt,
      defaultIndustry: leadSources.defaultIndustry, defaultMarket: leadSources.defaultMarket,
      runCount: sql<number>`(select count(*)::int from source_runs r where r.source_id = ${leadSources.id})`,
      lastRunStatus: sql<string | null>`(select r.status from source_runs r where r.source_id = ${leadSources.id} order by r.created_at desc limit 1)`,
      importedTotal: sql<number>`(select coalesce(sum(r.items_imported),0)::int from source_runs r where r.source_id = ${leadSources.id})`,
    })
    .from(leadSources)
    .where(and(eq(leadSources.workspaceId, ctx.user.workspaceId), isNull(leadSources.archivedAt)))
    .orderBy(desc(leadSources.createdAt));
  return rows;
}

export async function getSource(ctx: Ctx, id: string) {
  const [row] = await db
    .select()
    .from(leadSources)
    .where(and(eq(leadSources.id, id), eq(leadSources.workspaceId, ctx.user.workspaceId)));
  if (!row) throw fail("NOT_FOUND", "Source not found", 404);
  const runs = await db
    .select()
    .from(sourceRuns)
    .where(eq(sourceRuns.sourceId, id))
    .orderBy(desc(sourceRuns.createdAt))
    .limit(20);
  return { source: row, runs };
}

export type SourceInput = {
  name: string;
  description?: string;
  actorId: string;
  actorName?: string;
  inputDefaults?: Record<string, unknown>;
  mapping?: Record<string, string>;
  defaultIndustry?: string;
  defaultMarket?: string;
  defaultOpportunity?: string;
  schedule?: "OFF" | "DAILY" | "WEEKLY";
  scheduleHour?: number;
  verifyMx?: boolean;
  allowRoleAddresses?: boolean;
};

export async function createSource(ctx: Ctx, input: SourceInput) {
  if (!input.name?.trim()) throw fail("VALIDATION", "Source name is required");
  if (!input.actorId?.trim()) throw fail("VALIDATION", "Actor ID is required");
  const [row] = await db
    .insert(leadSources)
    .values({
      workspaceId: ctx.user.workspaceId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      actorId: input.actorId.trim(),
      actorName: input.actorName?.trim() || input.actorId.trim(),
      inputDefaults: input.inputDefaults ?? {},
      mapping: input.mapping ?? {},
      defaultIndustry: input.defaultIndustry || null,
      defaultMarket: input.defaultMarket || null,
      defaultOpportunity: (input.defaultOpportunity as never) || null,
      schedule: input.schedule ?? "OFF",
      scheduleHour: input.scheduleHour ?? 9,
      verifyMx: input.verifyMx ?? false,
      allowRoleAddresses: input.allowRoleAddresses ?? false,
      createdBy: ctx.user.userId,
    })
    .returning();
  await audit(ctx, "source.create", "source", row.id, { name: row.name, actor: row.actorId });
  return row;
}

export async function updateSource(ctx: Ctx, id: string, patch: Partial<SourceInput>) {
  const values: Record<string, unknown> = { updatedAt: new Date() };
  const map: Record<string, string> = {
    name: "name", description: "description", actorId: "actorId", actorName: "actorName",
    inputDefaults: "inputDefaults", mapping: "mapping", defaultIndustry: "defaultIndustry",
    defaultMarket: "defaultMarket", schedule: "schedule", scheduleHour: "scheduleHour",
    verifyMx: "verifyMx", allowRoleAddresses: "allowRoleAddresses",
  };
  for (const [from, to] of Object.entries(map)) {
    if (patch[from as keyof SourceInput] !== undefined) values[to] = patch[from as keyof SourceInput];
  }
  if (patch.defaultOpportunity !== undefined) values.defaultOpportunity = patch.defaultOpportunity || null;
  const [row] = await db
    .update(leadSources)
    .set(values as never)
    .where(and(eq(leadSources.id, id), eq(leadSources.workspaceId, ctx.user.workspaceId)))
    .returning();
  if (!row) throw fail("NOT_FOUND", "Source not found", 404);
  await audit(ctx, "source.update", "source", id, { fields: Object.keys(patch) });
  return row;
}

export async function archiveSource(ctx: Ctx, id: string) {
  const [row] = await db
    .update(leadSources)
    .set({ archivedAt: new Date() })
    .where(and(eq(leadSources.id, id), eq(leadSources.workspaceId, ctx.user.workspaceId)))
    .returning();
  if (!row) throw fail("NOT_FOUND", "Source not found", 404);
  await audit(ctx, "source.archive", "source", id);
  return row;
}

export async function startRun(ctx: Ctx, sourceId: string, opts: { test?: boolean } = {}) {
  const { source } = await getSource(ctx, sourceId);
  const [run] = await db
    .insert(sourceRuns)
    .values({
      workspaceId: ctx.user.workspaceId,
      sourceId,
      status: "QUEUED",
      input: { ...source.inputDefaults, ...(opts.test ? { maxItems: 5 } : {}) },
    })
    .returning();

  await enqueue(ctx.user.workspaceId, "APIFY_START", { runId: run.id }, {
    dedupeKey: `apify-start:${run.id}`,
  });
  await db.update(leadSources).set({ lastRunAt: new Date() }).where(eq(leadSources.id, sourceId));
  await audit(ctx, "source.run", "source", sourceId, { runId: run.id, test: !!opts.test });
  return run;
}

/* ── job handlers ───────────────────────────────────────────────────────── */

export async function processApifyStart(payload: { runId: string }) {
  const [run] = await db.select().from(sourceRuns).where(eq(sourceRuns.id, payload.runId));
  if (!run) return;
  const [source] = await db.select().from(leadSources).where(eq(leadSources.id, run.sourceId));
  if (!source) return;

  await db.update(sourceRuns).set({ status: "RUNNING", startedAt: new Date() }).where(eq(sourceRuns.id, run.id));

  try {
    const { runId } = await providers.apify.startRun(source.actorId, run.input);
    await db.update(sourceRuns).set({ apifyRunId: runId }).where(eq(sourceRuns.id, run.id));
    await enqueue(run.workspaceId, "APIFY_POLL", { runId: run.id }, {
      runAt: new Date(Date.now() + 2000),
      dedupeKey: `apify-poll:${run.id}:1`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "start failed";
    await db
      .update(sourceRuns)
      .set({ status: "FAILED", finishedAt: new Date(), error: { code: "APIFY_START", message } })
      .where(eq(sourceRuns.id, run.id));
    throw err;
  }
}

export async function processApifyPoll(payload: { runId: string; attempt?: number }) {
  const attempt = payload.attempt ?? 1;
  const [run] = await db.select().from(sourceRuns).where(eq(sourceRuns.id, payload.runId));
  if (!run || !run.apifyRunId) return;
  if (["FAILED", "CANCELLED", "IMPORTED"].includes(run.status)) return;

  const started = run.startedAt?.getTime() ?? Date.now();
  if (Date.now() - started > 45 * 60_000) {
    await db
      .update(sourceRuns)
      .set({ status: "FAILED", finishedAt: new Date(), error: { code: "TIMEOUT", message: "Run exceeded 45 minutes" } })
      .where(eq(sourceRuns.id, run.id));
    return;
  }

  const state = await providers.apify.getRun(run.apifyRunId);
  if (state.status === "RUNNING") {
    await enqueue(run.workspaceId, "APIFY_POLL", { runId: run.id, attempt: attempt + 1 }, {
      runAt: new Date(Date.now() + 4000),
      dedupeKey: `apify-poll:${run.id}:${attempt + 1}`,
    });
    return;
  }
  if (state.status === "FAILED") {
    await db
      .update(sourceRuns)
      .set({
        status: "FAILED", finishedAt: new Date(),
        error: { code: "APIFY_RUN", message: state.error ?? "Actor run failed" },
      })
      .where(eq(sourceRuns.id, run.id));
    return;
  }
  await enqueue(run.workspaceId, "APIFY_IMPORT", { runId: run.id }, { dedupeKey: `apify-import:${run.id}` });
}

export async function processApifyImport(payload: { runId: string }) {
  const [run] = await db.select().from(sourceRuns).where(eq(sourceRuns.id, payload.runId));
  if (!run?.apifyRunId) return;
  const [source] = await db.select().from(leadSources).where(eq(leadSources.id, run.sourceId));
  if (!source) return;

  const state = await providers.apify.getRun(run.apifyRunId);
  if (!state.datasetId) return;

  const pageSize = 1000;
  let fetched = 0;
  const collected: Record<string, unknown>[] = [];

  for (let page = 0; page < 30; page++) {
    const items = await providers.apify.getDatasetItems(state.datasetId, page * pageSize, pageSize);
    if (!items.length) break;
    fetched += items.length;
    for (const item of items) {
      const mapped: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(item)) {
        const target = source.mapping?.[key] ?? key;
        mapped[target] = value;
      }
      collected.push(mapped);
    }
    if (items.length < pageSize) break;
  }

  const result = await importRows(
    // System-driven import: attribute to the workspace owner.
    { user: { userId: source.createdBy ?? run.workspaceId, workspaceId: run.workspaceId, email: "", name: "System", role: "ADMIN", workspaceName: "" } } as Ctx,
    collected,
    {
      sourceId: source.id,
      sourceRunId: run.id,
      sourceLabel: `Apify · ${source.name}`,
      defaultIndustry: source.defaultIndustry ?? undefined,
      defaultMarket: source.defaultMarket ?? undefined,
      defaultOpportunity: source.defaultOpportunity ?? undefined,
      allowRoleAddresses: source.allowRoleAddresses,
    },
  );

  await db
    .update(sourceRuns)
    .set({
      status: "IMPORTED",
      finishedAt: new Date(),
      itemsFetched: fetched,
      itemsImported: result.imported,
      itemsDuplicate: result.duplicate,
      itemsInvalid: result.invalid,
      itemsQualified: result.qualified,
      itemsDisqualified: result.imported - result.qualified,
      sampleItems: collected.slice(0, 5),
    })
    .where(eq(sourceRuns.id, run.id));
}

export async function listRuns(ctx: Ctx) {
  return db
    .select({
      id: sourceRuns.id, status: sourceRuns.status,
      isTest: sql<boolean>`coalesce((${sourceRuns.input}->>'test')::boolean, false)`,
      createdAt: sourceRuns.createdAt, finishedAt: sourceRuns.finishedAt,
      itemsFetched: sourceRuns.itemsFetched, itemsImported: sourceRuns.itemsImported,
      itemsDuplicate: sourceRuns.itemsDuplicate, itemsInvalid: sourceRuns.itemsInvalid,
      itemsQualified: sourceRuns.itemsQualified, error: sourceRuns.error,
      sourceName: leadSources.name, sourceId: leadSources.id,
    })
    .from(sourceRuns)
    .innerJoin(leadSources, eq(leadSources.id, sourceRuns.sourceId))
    .where(eq(sourceRuns.workspaceId, ctx.user.workspaceId))
    .orderBy(desc(sourceRuns.createdAt))
    .limit(100);
}

export async function getRun(ctx: Ctx, id: string) {
  const [row] = await db
    .select({
      run: sourceRuns,
      sourceName: leadSources.name,
      actorId: leadSources.actorId,
    })
    .from(sourceRuns)
    .innerJoin(leadSources, eq(leadSources.id, sourceRuns.sourceId))
    .where(and(eq(sourceRuns.id, id), eq(sourceRuns.workspaceId, ctx.user.workspaceId)));
  if (!row) throw fail("NOT_FOUND", "Run not found", 404);
  return row;
}

export async function cancelRun(ctx: Ctx, id: string) {
  const [row] = await db
    .update(sourceRuns)
    .set({ status: "CANCELLED", finishedAt: new Date() })
    .where(and(eq(sourceRuns.id, id), eq(sourceRuns.workspaceId, ctx.user.workspaceId)))
    .returning();
  if (!row) throw fail("NOT_FOUND", "Run not found", 404);
  await audit(ctx, "run.cancel", "source_run", id);
  return row;
}
