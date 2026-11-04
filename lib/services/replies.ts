import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { createHmac } from "node:crypto";

import { db } from "@/lib/db/client";
import {
  enrollments, messages, notifications, prospectEvents, prospects, replies, suppressions, users,
} from "@/lib/db/schema";
import { providers } from "@/lib/providers";
import type { Ctx } from "./common";
import { audit, fail } from "./common";
import { addBusinessDays, nextWindowStart } from "@/lib/utils";
import { normalizeEmail } from "@/lib/taxonomy/enums";

export type InboundMessage = {
  from: string;
  to: string;
  subject: string;
  bodyText: string;
  inReplyTo?: string;
  references?: string[];
  receivedAt?: Date;
  uid?: number;
  uidvalidity?: number;
  folder?: string;
};

const UNSUB_INTENT = /\b(unsubscribe|remove me|take me off|stop emailing|opt out)\b/i;
const OOO_INTENT = /\b(out of (the )?office|on annual leave|on holiday|away until|auto[- ]?reply|automatic reply)\b/i;

export async function handleInbound(workspaceId: string, msg: InboundMessage, assignedUserId?: string | null) {
  const from = normalizeEmail(msg.from);
  if (!from) return null;

  const [prospect] = await db
    .select()
    .from(prospects)
    .where(and(eq(prospects.workspaceId, workspaceId), eq(prospects.contactEmailNormalized, from), isNull(prospects.deletedAt)))
    .limit(1);

  let matchedMessageId: string | null = null;
  if (prospect && (msg.inReplyTo || msg.references?.length)) {
    const ids = [msg.inReplyTo, ...(msg.references ?? [])].filter(Boolean) as string[];
    const [matched] = await db
      .select({ id: messages.id })
      .from(messages)
      .where(and(eq(messages.workspaceId, workspaceId), inArray(messages.messageIdHeader, ids)))
      .limit(1);
    matchedMessageId = matched?.id ?? null;
  }
  if (prospect && !matchedMessageId) {
    const [last] = await db
      .select({ id: messages.id })
      .from(messages)
      .where(and(eq(messages.prospectId, prospect.id), eq(messages.status, "SENT")))
      .orderBy(desc(messages.sentAt))
      .limit(1);
    matchedMessageId = last?.id ?? null;
  }

  const isUnsub = UNSUB_INTENT.test(`${msg.subject} ${msg.bodyText}`);
  const isOoo = OOO_INTENT.test(`${msg.subject} ${msg.bodyText}`);
  const outcome = isOoo ? "OOO" : isUnsub ? "NOT_INTERESTED" : null;

  const [row] = await db
    .insert(replies)
    .values({
      workspaceId,
      prospectId: prospect?.id ?? null,
      messageId: matchedMessageId,
      fromEmail: from,
      toEmail: msg.to,
      subject: msg.subject.slice(0, 255),
      bodyText: msg.bodyText.slice(0, 50_000),
      snippet: msg.bodyText.replace(/\s+/g, " ").slice(0, 200),
      receivedAt: msg.receivedAt ?? new Date(),
      imapUid: msg.uid ?? null,
      imapUidvalidity: msg.uidvalidity ?? null,
      imapFolder: msg.folder ?? "INBOX",
      assignedUserId: assignedUserId ?? prospect?.ownerUserId ?? null,
      outcome: outcome as never,
    })
    .returning();

  if (!prospect) return row;

  await db.update(prospects).set({
    lastReplyAt: new Date(),
    contactQuality: "VERIFIED",
    updatedAt: new Date(),
  }).where(eq(prospects.id, prospect.id));

  const [active] = await db
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.prospectId, prospect.id), eq(enrollments.status, "ACTIVE")));

  if (isOoo) {
    // No stop: push the next step by two business days, twice at most.
    if (active && active.oooPushes < 2) {
      const next = nextWindowStart(addBusinessDays(new Date(), 2));
      await db.update(enrollments).set({ nextSendAt: next, oooPushes: active.oooPushes + 1 }).where(eq(enrollments.id, active.id));
      await db.update(replies).set({ outcome: "OOO" }).where(eq(replies.id, row.id));
    }
    await db.insert(prospectEvents).values({
      prospectId: prospect.id,
      type: "reply_ooo",
      payload: { subject: msg.subject },
    });
    return row;
  }

  if (active) {
    await db
      .update(enrollments)
      .set({ status: "STOPPED", stopReason: isUnsub ? "unsubscribed" : "replied", nextSendAt: null })
      .where(eq(enrollments.id, active.id));
    await db.delete(messages).where(and(eq(messages.prospectId, prospect.id), eq(messages.status, "QUEUED")));
  }

  if (isUnsub) {
    await db
      .insert(suppressions)
      .values({
        workspaceId,
        emailNormalized: from,
        reason: "UNSUBSCRIBED",
        source: "email reply",
        note: msg.subject,
        createdBy: assignedUserId ?? null,
      })
      .onConflictDoNothing();
    await db.update(prospects).set({ contactability: "UNSUBSCRIBED" }).where(eq(prospects.id, prospect.id));
  } else if (!["MEETING", "PROPOSAL", "WON", "LOST", "DISQUALIFIED"].includes(prospect.stage)) {
    await db.update(prospects).set({ stage: "REPLIED" }).where(eq(prospects.id, prospect.id));
  }

  await db.insert(prospectEvents).values({
    prospectId: prospect.id,
    type: isUnsub ? "unsubscribed" : "replied",
    payload: { subject: msg.subject, snippet: row.snippet },
  });

  const owner = prospect.ownerUserId
    ? (await db.select({ id: users.id }).from(users).where(eq(users.id, prospect.ownerUserId)))[0]
    : null;

  await db.insert(notifications).values({
    workspaceId,
    userId: owner?.id ?? null,
    kind: "reply",
    title: `Reply from ${prospect.businessName}`,
    body: row.snippet ?? "",
    href: `/inbox?reply=${row.id}`,
  });

  await audit(
    { user: { userId: assignedUserId ?? prospect.ownerUserId ?? "", workspaceId, email: "", name: "System", role: "ADMIN", workspaceName: "" } },
    "inbox.reply",
    "reply",
    row.id,
    { prospectId: prospect.id, unsubscribed: isUnsub },
  );

  return row;
}

export async function syncImap(ctx: Ctx) {
  const msgs = await providers.imap.fetchSince(null);
  let created = 0;
  for (const m of msgs) {
    const row = await handleInbound(ctx.user.workspaceId, m);
    if (row) created++;
  }
  await audit(ctx, "imap.sync", undefined, undefined, { fetched: msgs.length, created });
  return { fetched: msgs.length, created };
}

export async function simulateReply(ctx: Ctx, prospectId: string, body: string, opts: { unsubscribe?: boolean } = {}) {
  const [p] = await db
    .select()
    .from(prospects)
    .where(and(eq(prospects.id, prospectId), eq(prospects.workspaceId, ctx.user.workspaceId)));
  if (!p) throw fail("NOT_FOUND", "Prospect not found", 404);
  const email = p.contactEmailNormalized;
  if (!email) throw fail("VALIDATION", "Prospect has no email address");

  const [lastMessage] = await db
    .select({ messageIdHeader: messages.messageIdHeader, subject: messages.subject, toEmail: messages.toEmail })
    .from(messages)
    .where(eq(messages.prospectId, prospectId))
    .orderBy(desc(messages.sentAt))
    .limit(1);

  const text = opts.unsubscribe
    ? "Please remove me from your list and do not contact me again."
    : body || "Thanks for reaching out — happy to chat. What does a project like ours usually cost?";

  return handleInbound(
    ctx.user.workspaceId,
    {
      from: p.contactEmail!,
      to: lastMessage?.toEmail ?? process.env.RESEND_FROM_EMAIL ?? "hello@localhost",
      subject: `Re: ${lastMessage?.subject ?? "your email"}`,
      bodyText: text,
      inReplyTo: lastMessage?.messageIdHeader ?? undefined,
      receivedAt: new Date(),
      uid: Math.floor(Math.random() * 100000),
      uidvalidity: 777,
    },
    ctx.user.userId,
  );
}

export async function listInbox(
  ctx: Ctx,
  filters: { unread?: boolean; mine?: boolean; outcome?: string; q?: string } = {},
) {
  const parts = [eq(replies.workspaceId, ctx.user.workspaceId)];
  if (filters.unread) parts.push(eq(replies.isRead, false));
  if (filters.mine) parts.push(eq(replies.assignedUserId, ctx.user.userId));
  if (filters.outcome) parts.push(eq(replies.outcome, filters.outcome as never));
  if (filters.q) {
    const term = `%${filters.q.toLowerCase()}%`;
    parts.push(or(
      sql`lower(${replies.subject}) like ${term}`,
      sql`lower(coalesce(${replies.snippet}, '')) like ${term}`,
      sql`lower(${replies.fromEmail}) like ${term}`,
    )!);
  }

  return db
    .select({
      id: replies.id,
      subject: replies.subject,
      snippet: replies.snippet,
      fromEmail: replies.fromEmail,
      receivedAt: replies.receivedAt,
      isRead: replies.isRead,
      outcome: replies.outcome,
      assignedUserId: replies.assignedUserId,
      prospectId: prospects.id,
      businessName: prospects.businessName,
      stage: prospects.stage,
      priority: prospects.priority,
      assignee: users.name,
    })
    .from(replies)
    .leftJoin(prospects, eq(prospects.id, replies.prospectId))
    .leftJoin(users, eq(users.id, replies.assignedUserId))
    .where(and(...parts))
    .orderBy(desc(replies.receivedAt))
    .limit(100);
}

export async function getReply(ctx: Ctx, id: string) {
  const [row] = await db
    .select({ reply: replies, prospect: prospects })
    .from(replies)
    .leftJoin(prospects, eq(prospects.id, replies.prospectId))
    .where(and(eq(replies.id, id), eq(replies.workspaceId, ctx.user.workspaceId)));
  if (!row) throw fail("NOT_FOUND", "Reply not found", 404);
  return row;
}

export async function updateReply(
  ctx: Ctx,
  id: string,
  patch: { isRead?: boolean; outcome?: string | null; assignedUserId?: string | null },
) {
  const values: Record<string, unknown> = {};
  if (patch.isRead !== undefined) values.isRead = patch.isRead;
  if (patch.outcome !== undefined) values.outcome = patch.outcome || null;
  if (patch.assignedUserId !== undefined) values.assignedUserId = patch.assignedUserId || null;
  const [row] = await db
    .update(replies)
    .set(values as never)
    .where(and(eq(replies.id, id), eq(replies.workspaceId, ctx.user.workspaceId)))
    .returning();
  if (!row) throw fail("NOT_FOUND", "Reply not found", 404);
  await audit(ctx, "inbox.update", "reply", id, patch);
  return row;
}

export async function unreadReplyCount(workspaceId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(replies)
    .where(and(eq(replies.workspaceId, workspaceId), eq(replies.isRead, false)));
  return row?.count ?? 0;
}

export function unsubscribeToken(email: string, workspaceId: string) {
  const payload = Buffer.from(`${workspaceId}:${email}`).toString("base64url");
  const sig = createHmac("sha256", process.env.TRACKING_SECRET ?? "local-tracking-secret")
    .update(payload).digest("base64url").slice(0, 24);
  return `${payload}.${sig}`;
}

export function readUnsubscribeToken(token: string): { workspaceId: string; email: string } | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", process.env.TRACKING_SECRET ?? "local-tracking-secret")
    .update(payload).digest("base64url").slice(0, 24);
  if (sig !== expected) return null;
  const [workspaceId, email] = Buffer.from(payload, "base64url").toString("utf8").split(":");
  return workspaceId && email ? { workspaceId, email } : null;
}

export async function handleUnsubscribe(token: { workspaceId: string; email: string }) {
  await db
    .insert(suppressions)
    .values({
      workspaceId: token.workspaceId,
      emailNormalized: token.email,
      reason: "UNSUBSCRIBED",
      source: "unsubscribe link",
    })
    .onConflictDoNothing();
  const [p] = await db
    .select({ id: prospects.id })
    .from(prospects)
    .where(and(eq(prospects.workspaceId, token.workspaceId), eq(prospects.contactEmailNormalized, token.email)))
    .limit(1);
  if (p) {
    await db.update(prospects).set({ contactability: "UNSUBSCRIBED", updatedAt: new Date() }).where(eq(prospects.id, p.id));
    await db
      .update(enrollments)
      .set({ status: "STOPPED", stopReason: "unsubscribed", nextSendAt: null })
      .where(and(eq(enrollments.prospectId, p.id), eq(enrollments.status, "ACTIVE")));
    await db.insert(prospectEvents).values({ prospectId: p.id, type: "unsubscribed", payload: { source: "link" } });
  }
  return true;
}

export async function markDelivered(workspaceId: string, messageId: string) {
  await db
    .update(messages)
    .set({ status: "DELIVERED" })
    .where(and(eq(messages.workspaceId, workspaceId), eq(messages.id, messageId)));
}

export async function recordOpen(messageId: string) {
  const [row] = await db.select({ count: messages.openCount, workspaceId: messages.workspaceId })
    .from(messages).where(eq(messages.id, messageId));
  if (!row) return;
  await db.update(messages).set({
    status: "DELIVERED",
    openCount: (row.count ?? 0) + 1,
    openedAt: new Date(),
  }).where(eq(messages.id, messageId));
}

export async function recordClick(messageId: string) {
  const [row] = await db.select({ count: messages.clickCount }).from(messages).where(eq(messages.id, messageId));
  if (!row) return;
  await db.update(messages).set({
    clickCount: (row.count ?? 0) + 1,
    clickedAt: new Date(),
  }).where(eq(messages.id, messageId));
}
