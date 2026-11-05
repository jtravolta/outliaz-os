import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  enrollments, leadSources, messages, prospectNotes, prospects, replies, sourceRuns,
} from "@/lib/db/schema";
import type { Ctx } from "./common";
import { listShellNotifications } from "./shell-notifications";
import { STAGES } from "@/lib/taxonomy/enums";

export async function dashboard(ctx: Ctx) {
  const ws = ctx.user.workspaceId;
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const today = dayStart.toISOString().slice(0, 10);

  // These reads are independent, so they run concurrently. The database is
  // remote, so awaiting them one by one multiplied the network round trip by
  // the number of queries and dominated the page's time to first byte.
  const [totalsRows, followUpRows, sendingRows, replyRows, stageRows, seriesRows, recentRuns, recentReplies, activeRows, jobRows] =
    await Promise.all([
      db
        .select({
          total: sql<number>`count(*)::int`,
          newThisWeek: sql<number>`count(*) filter (where created_at >= ${weekAgo.toISOString()})::int`,
          researchQueue: sql<number>`count(*) filter (where stage = 'NEW')::int`,
          qualifyQueue: sql<number>`count(*) filter (where stage = 'RESEARCHED')::int`,
        })
        .from(prospects)
        .where(and(eq(prospects.workspaceId, ws), isNull(prospects.deletedAt))),
      db
        .select({
          overdue: sql<number>`count(*) filter (where follow_up_date < ${today})::int`,
          today: sql<number>`count(*) filter (where follow_up_date = ${today})::int`,
          week: sql<number>`count(*) filter (where follow_up_date between ${today} and ${new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)})::int`,
        })
        .from(prospects)
        .where(and(eq(prospects.workspaceId, ws), isNull(prospects.deletedAt))),
      db
        .select({
          sent7d: sql<number>`count(*) filter (where sent_at >= ${weekAgo.toISOString()})::int`,
          sent30d: sql<number>`count(*) filter (where sent_at >= ${new Date(Date.now() - 30 * 86_400_000).toISOString()})::int`,
          opened: sql<number>`count(*) filter (where opened_at is not null)::int`,
        })
        .from(messages)
        .where(and(eq(messages.workspaceId, ws), eq(messages.status, "SENT"))),
      db
        .select({
          all: sql<number>`count(*)::int`,
          replied7d: sql<number>`count(*) filter (where received_at >= ${weekAgo.toISOString()})::int`,
          unread: sql<number>`count(*) filter (where is_read = false)::int`,
        })
        .from(replies)
        .where(eq(replies.workspaceId, ws)),
      db
        .select({ stage: prospects.stage, count: sql<number>`count(*)::int` })
        .from(prospects)
        .where(and(eq(prospects.workspaceId, ws), isNull(prospects.deletedAt)))
        .groupBy(prospects.stage),
      db.execute(sql`
        with days as (
          select generate_series(current_date - interval '29 days', current_date, interval '1 day')::date as day
        )
        select to_char(d.day, 'YYYY-MM-DD') as day,
          (select count(*)::int from messages m where m.workspace_id = ${ws} and m.sent_at::date = d.day) as sent,
          (select count(*)::int from replies r where r.workspace_id = ${ws} and r.received_at::date = d.day) as replies
        from days d order by d.day
      `) as unknown as Promise<{ day: string; sent: number; replies: number }[]>,
      db
        .select({
          id: sourceRuns.id, status: sourceRuns.status, createdAt: sourceRuns.createdAt,
          itemsImported: sourceRuns.itemsImported, itemsFetched: sourceRuns.itemsFetched,
          sourceName: leadSources.name,
        })
        .from(sourceRuns)
        .leftJoin(leadSources, eq(leadSources.id, sourceRuns.sourceId))
        .where(eq(sourceRuns.workspaceId, ws))
        .orderBy(desc(sourceRuns.createdAt))
        .limit(5),
      db
        .select({
          id: replies.id, subject: replies.subject, snippet: replies.snippet, receivedAt: replies.receivedAt,
          isRead: replies.isRead, businessName: prospects.businessName, prospectId: prospects.id,
        })
        .from(replies)
        .leftJoin(prospects, eq(prospects.id, replies.prospectId))
        .where(eq(replies.workspaceId, ws))
        .orderBy(desc(replies.receivedAt))
        .limit(5),
      db
        .select({ active: sql<number>`count(*)::int` })
        .from(enrollments)
        .where(and(eq(enrollments.workspaceId, ws), eq(enrollments.status, "ACTIVE"))),
      db.execute(sql`
        select count(*) filter (where status = 'PENDING')::int as pending,
               count(*) filter (where status = 'DEAD')::int as dead
        from jobs where workspace_id = ${ws}
      `) as unknown as Promise<{ pending: number; dead: number }[]>,
    ]);

  const [totals] = totalsRows;
  const [followUps] = followUpRows;
  const [sending] = sendingRows;
  const [replyStats] = replyRows;
  const series = seriesRows;
  const [active] = activeRows;
  const [jobStats] = jobRows;

  const pipeline = STAGES.map(([slug]) => ({
    stage: slug,
    count: stageRows.find((r) => r.stage === slug)?.count ?? 0,
  }));

  const dbNotifs = await listShellNotifications();

  const notifs = dbNotifs.map((n) => ({
    id: n.id,
    kind: n.kind,
    title: n.title,
    body: n.body,
    href: n.href,
    readAt: n.readAt,
  }));

  const replyRate = sending.sent7d ? Math.round((replyStats.replied7d / sending.sent7d) * 100) : 0;

  return {
    totals, followUps, sending, replyStats, pipeline, series,
    recentRuns, recentReplies, activeEnrollments: active?.active ?? 0,
    jobs: jobStats ?? { pending: 0, dead: 0 },
    replyRate,
    notifications: notifs,
  };
}

export async function reports(ctx: Ctx) {
  const ws = ctx.user.workspaceId;
  const [deliverabilityRows, stageRows, sources, byIndustry, bySource] =
    await Promise.all([
      db
        .select({
          sent: sql<number>`count(*) filter (where status in ('SENT','DELIVERED'))::int`,
          opened: sql<number>`count(*) filter (where opened_at is not null)::int`,
          clicked: sql<number>`count(*) filter (where clicked_at is not null)::int`,
          bounced: sql<number>`count(*) filter (where status = 'BOUNCED')::int`,
          failed: sql<number>`count(*) filter (where status = 'FAILED')::int`,
        })
        .from(messages)
        .where(eq(messages.workspaceId, ws)),
      db
        .select({ stage: prospects.stage, count: sql<number>`count(*)::int` })
        .from(prospects)
        .where(and(eq(prospects.workspaceId, ws), isNull(prospects.deletedAt)))
        .groupBy(prospects.stage),
      db
        .select({
          id: leadSources.id,
          name: leadSources.name,
          runs: sql<number>`(select count(*)::int from source_runs r where r.source_id = ${leadSources.id})`,
          imported: sql<number>`(select coalesce(sum(r.items_imported),0)::int from source_runs r where r.source_id = ${leadSources.id})`,
          qualified: sql<number>`(select coalesce(sum(r.items_qualified),0)::int from source_runs r where r.source_id = ${leadSources.id})`,
          duplicates: sql<number>`(select coalesce(sum(r.items_duplicate),0)::int from source_runs r where r.source_id = ${leadSources.id})`,
          invalid: sql<number>`(select coalesce(sum(r.items_invalid),0)::int from source_runs r where r.source_id = ${leadSources.id})`,
        })
        .from(leadSources)
        .where(eq(leadSources.workspaceId, ws)),
      db
        .select({ industry: prospects.industrySlug, count: sql<number>`count(*)::int` })
        .from(prospects)
        .where(and(eq(prospects.workspaceId, ws), isNull(prospects.deletedAt)))
        .groupBy(prospects.industrySlug),
      db
        .select({
          source: sql<string>`coalesce(${leadSources.name}, 'Manual')`,
          count: sql<number>`count(*)::int`,
        })
        .from(prospects)
        .leftJoin(leadSources, eq(leadSources.id, prospects.sourceId))
        .where(and(eq(prospects.workspaceId, ws), isNull(prospects.deletedAt)))
        .groupBy(sql`coalesce(${leadSources.name}, 'Manual')`),
    ]);

  const [deliverability] = deliverabilityRows;

  return { deliverability, pipeline: stageRows, sources, byIndustry, bySource };
}

export async function notesFor(ctx: Ctx, prospectId: string) {
  return db
    .select({ id: prospectNotes.id, bodyMd: prospectNotes.bodyMd, createdAt: prospectNotes.createdAt })
    .from(prospectNotes)
    .where(eq(prospectNotes.prospectId, prospectId))
    .orderBy(desc(prospectNotes.createdAt));
}
