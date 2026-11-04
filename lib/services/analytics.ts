import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  enrollments, leadSources, messages, notifications, prospectNotes, prospects, replies, sourceRuns,
} from "@/lib/db/schema";
import type { Ctx } from "./common";
import { STAGES } from "@/lib/taxonomy/enums";

export async function dashboard(ctx: Ctx) {
  const ws = ctx.user.workspaceId;
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const today = dayStart.toISOString().slice(0, 10);

  const [totals] = await db
    .select({
      total: sql<number>`count(*)::int`,
      newThisWeek: sql<number>`count(*) filter (where created_at >= ${weekAgo.toISOString()})::int`,
      researchQueue: sql<number>`count(*) filter (where stage = 'NEW')::int`,
      qualifyQueue: sql<number>`count(*) filter (where stage = 'RESEARCHED')::int`,
    })
    .from(prospects)
    .where(and(eq(prospects.workspaceId, ws), isNull(prospects.deletedAt)));

  const [followUps] = await db
    .select({
      overdue: sql<number>`count(*) filter (where follow_up_date < ${today})::int`,
      today: sql<number>`count(*) filter (where follow_up_date = ${today})::int`,
      week: sql<number>`count(*) filter (where follow_up_date between ${today} and ${new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)})::int`,
    })
    .from(prospects)
    .where(and(eq(prospects.workspaceId, ws), isNull(prospects.deletedAt)));

  const [sending] = await db
    .select({
      sent7d: sql<number>`count(*) filter (where sent_at >= ${weekAgo.toISOString()})::int`,
      sent30d: sql<number>`count(*) filter (where sent_at >= ${new Date(Date.now() - 30 * 86_400_000).toISOString()})::int`,
      opened: sql<number>`count(*) filter (where opened_at is not null)::int`,
    })
    .from(messages)
    .where(and(eq(messages.workspaceId, ws), eq(messages.status, "SENT")));

  const [replyStats] = await db
    .select({
      all: sql<number>`count(*)::int`,
      replied7d: sql<number>`count(*) filter (where received_at >= ${weekAgo.toISOString()})::int`,
      unread: sql<number>`count(*) filter (where is_read = false)::int`,
    })
    .from(replies)
    .where(eq(replies.workspaceId, ws));

  const stageRows = await db
    .select({ stage: prospects.stage, count: sql<number>`count(*)::int` })
    .from(prospects)
    .where(and(eq(prospects.workspaceId, ws), isNull(prospects.deletedAt)))
    .groupBy(prospects.stage);

  const pipeline = STAGES.map(([slug]) => ({
    stage: slug,
    count: stageRows.find((r) => r.stage === slug)?.count ?? 0,
  }));

  const series = await db.execute(sql`
    with days as (
      select generate_series(current_date - interval '29 days', current_date, interval '1 day')::date as day
    )
    select to_char(d.day, 'YYYY-MM-DD') as day,
      (select count(*)::int from messages m where m.workspace_id = ${ws} and m.sent_at::date = d.day) as sent,
      (select count(*)::int from replies r where r.workspace_id = ${ws} and r.received_at::date = d.day) as replies
    from days d order by d.day
  `) as unknown as { day: string; sent: number; replies: number }[];

  const recentRuns = await db
    .select({
      id: sourceRuns.id, status: sourceRuns.status, createdAt: sourceRuns.createdAt,
      itemsImported: sourceRuns.itemsImported, itemsFetched: sourceRuns.itemsFetched,
      sourceName: leadSources.name,
    })
    .from(sourceRuns)
    .leftJoin(leadSources, eq(leadSources.id, sourceRuns.sourceId))
    .where(eq(sourceRuns.workspaceId, ws))
    .orderBy(desc(sourceRuns.createdAt))
    .limit(5);

  const recentReplies = await db
    .select({
      id: replies.id, subject: replies.subject, snippet: replies.snippet, receivedAt: replies.receivedAt,
      isRead: replies.isRead, businessName: prospects.businessName, prospectId: prospects.id,
    })
    .from(replies)
    .leftJoin(prospects, eq(prospects.id, replies.prospectId))
    .where(eq(replies.workspaceId, ws))
    .orderBy(desc(replies.receivedAt))
    .limit(5);

  const notifs = await db
    .select({
      id: notifications.id, kind: notifications.kind, title: notifications.title, body: notifications.body,
      href: notifications.href, readAt: notifications.readAt,
    })
    .from(notifications)
    .where(eq(notifications.workspaceId, ws))
    .orderBy(desc(notifications.createdAt))
    .limit(8);

  const [active] = await db
    .select({ active: sql<number>`count(*)::int` })
    .from(enrollments)
    .where(and(eq(enrollments.workspaceId, ws), eq(enrollments.status, "ACTIVE")));

  const [jobStats] = await db.execute(sql`
    select count(*) filter (where status = 'PENDING')::int as pending,
           count(*) filter (where status = 'DEAD')::int as dead
    from jobs where workspace_id = ${ws}
  `) as unknown as { pending: number; dead: number }[];

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
  const [deliverability] = await db
    .select({
      sent: sql<number>`count(*) filter (where status in ('SENT','DELIVERED'))::int`,
      opened: sql<number>`count(*) filter (where opened_at is not null)::int`,
      clicked: sql<number>`count(*) filter (where clicked_at is not null)::int`,
      bounced: sql<number>`count(*) filter (where status = 'BOUNCED')::int`,
      failed: sql<number>`count(*) filter (where status = 'FAILED')::int`,
    })
    .from(messages)
    .where(eq(messages.workspaceId, ws));

  const stageRows = await db
    .select({ stage: prospects.stage, count: sql<number>`count(*)::int` })
    .from(prospects)
    .where(and(eq(prospects.workspaceId, ws), isNull(prospects.deletedAt)))
    .groupBy(prospects.stage);

  const sources = await db
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
    .where(eq(leadSources.workspaceId, ws));

  const byIndustry = await db
    .select({ industry: prospects.industrySlug, count: sql<number>`count(*)::int` })
    .from(prospects)
    .where(and(eq(prospects.workspaceId, ws), isNull(prospects.deletedAt)))
    .groupBy(prospects.industrySlug);

  const bySource = await db
    .select({ source: prospects.sourceLabel, count: sql<number>`count(*)::int` })
    .from(prospects)
    .where(and(eq(prospects.workspaceId, ws), isNull(prospects.deletedAt)))
    .groupBy(prospects.sourceLabel);

  return { deliverability, pipeline: stageRows, sources, byIndustry, bySource };
}

export async function notesFor(ctx: Ctx, prospectId: string) {
  return db
    .select({ id: prospectNotes.id, bodyMd: prospectNotes.bodyMd, createdAt: prospectNotes.createdAt })
    .from(prospectNotes)
    .where(eq(prospectNotes.prospectId, prospectId))
    .orderBy(desc(prospectNotes.createdAt));
}
