import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  emailTemplates, enrollments, prospects, replies, sequenceSteps, sequences,
} from "@/lib/db/schema";
import type { Ctx } from "./common";
import { audit, fail, requireRole } from "./common";
import { enrollmentMissing } from "@/lib/taxonomy/gates";
import { getProspect } from "./prospects";
import { enqueue } from "@/lib/jobs/queue";
import { nextWindowStart } from "@/lib/utils";

export async function listSequences(ctx: Ctx) {
  const rows = await db
    .select({
      id: sequences.id, name: sequences.name, description: sequences.description,
      status: sequences.status, createdAt: sequences.createdAt,
    })
    .from(sequences)
    .where(eq(sequences.workspaceId, ctx.user.workspaceId))
    .orderBy(desc(sequences.createdAt));

  const sequenceIds = rows.map((r) => r.id);
  const stepRows = sequenceIds.length
    ? await db
      .select({ sequenceId: sequenceSteps.sequenceId, count: sql<number>`count(*)::int` })
      .from(sequenceSteps)
      .where(inArray(sequenceSteps.sequenceId, sequenceIds))
      .groupBy(sequenceSteps.sequenceId)
    : [];
  const enrollmentRows = sequenceIds.length
    ? await db
      .select({ sequenceId: enrollments.sequenceId, status: enrollments.status, count: sql<number>`count(*)::int` })
      .from(enrollments)
      .where(inArray(enrollments.sequenceId, sequenceIds))
      .groupBy(enrollments.sequenceId, enrollments.status)
    : [];
  const replyRows = sequenceIds.length
    ? await db
      .select({ sequenceId: enrollments.sequenceId, count: sql<number>`count(distinct ${replies.prospectId})::int` })
      .from(replies)
      .innerJoin(enrollments, eq(enrollments.prospectId, replies.prospectId))
      .where(inArray(enrollments.sequenceId, sequenceIds))
      .groupBy(enrollments.sequenceId)
    : [];

  const stepsBySeq = new Map<string, number>();
  for (const r of stepRows) stepsBySeq.set(r.sequenceId, r.count ?? 0);
  const enrollmentsBySeq = new Map<string, { total: number; active: number }>();
  for (const r of enrollmentRows) {
    const cur = enrollmentsBySeq.get(r.sequenceId) ?? { total: 0, active: 0 };
    cur.total += r.count ?? 0;
    if (r.status === "ACTIVE") cur.active += r.count ?? 0;
    enrollmentsBySeq.set(r.sequenceId, cur);
  }
  const repliesBySeq = new Map<string, number>();
  for (const r of replyRows) repliesBySeq.set(r.sequenceId, r.count ?? 0);

  return rows.map((r) => ({
    ...r,
    steps: stepsBySeq.get(r.id) ?? 0,
    enrolled: enrollmentsBySeq.get(r.id)?.total ?? 0,
    active: enrollmentsBySeq.get(r.id)?.active ?? 0,
    replies: repliesBySeq.get(r.id) ?? 0,
  }));
}

export async function getSequence(ctx: Ctx, id: string) {
  const [seq] = await db
    .select()
    .from(sequences)
    .where(and(eq(sequences.id, id), eq(sequences.workspaceId, ctx.user.workspaceId)));
  if (!seq) throw fail("NOT_FOUND", "Sequence not found", 404);

  const steps = await db
    .select({
      step: sequenceSteps,
      templateName: emailTemplates.name,
      templateSubject: emailTemplates.subject,
      templateBody: emailTemplates.bodyMd,
    })
    .from(sequenceSteps)
    .leftJoin(emailTemplates, eq(emailTemplates.id, sequenceSteps.templateId))
    .where(eq(sequenceSteps.sequenceId, id))
    .orderBy(asc(sequenceSteps.position));

  const stats = await db
    .select({
      status: enrollments.status,
      count: sql<number>`count(*)::int`,
    })
    .from(enrollments)
    .where(eq(enrollments.sequenceId, id))
    .groupBy(enrollments.status);

  const enrolled = await db
    .select({
      id: enrollments.id, status: enrollments.status, currentStep: enrollments.currentStep,
      nextSendAt: enrollments.nextSendAt, stopReason: enrollments.stopReason,
      prospectId: prospects.id, businessName: prospects.businessName, email: prospects.contactEmail,
      stage: prospects.stage,
    })
    .from(enrollments)
    .innerJoin(prospects, eq(prospects.id, enrollments.prospectId))
    .where(eq(enrollments.sequenceId, id))
    .orderBy(desc(enrollments.createdAt))
    .limit(100);

  return { sequence: seq, steps, stats, enrollments: enrolled };
}

export type StepInput = {
  templateId?: string | null;
  subjectOverride?: string;
  bodyOverrideMd?: string;
  delayBusinessDays?: number;
};

export async function createSequence(ctx: Ctx, input: { name: string; description?: string; steps?: StepInput[] }) {
  requireRole(ctx, ["OWNER", "ADMIN", "MEMBER"]);
  if (!input.name?.trim()) throw fail("VALIDATION", "Sequence name is required");
  const [seq] = await db
    .insert(sequences)
    .values({
      workspaceId: ctx.user.workspaceId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      createdBy: ctx.user.userId,
    })
    .returning();
  if (input.steps?.length) await saveSteps(ctx, seq.id, input.steps);
  await audit(ctx, "sequence.create", "sequence", seq.id, { name: seq.name });
  return seq;
}

export async function updateSequence(ctx: Ctx, id: string, patch: { name?: string; description?: string; steps?: StepInput[] }) {
  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.name !== undefined) values.name = patch.name.trim();
  if (patch.description !== undefined) values.description = patch.description.trim() || null;
  const [seq] = await db
    .update(sequences)
    .set(values as never)
    .where(and(eq(sequences.id, id), eq(sequences.workspaceId, ctx.user.workspaceId)))
    .returning();
  if (!seq) throw fail("NOT_FOUND", "Sequence not found", 404);
  if (patch.steps) await saveSteps(ctx, id, patch.steps);
  await audit(ctx, "sequence.update", "sequence", id, { fields: Object.keys(patch) });
  return seq;
}

export async function saveSteps(ctx: Ctx, sequenceId: string, steps: StepInput[]) {
  if (steps.length > 12) throw fail("VALIDATION", "A sequence can have at most 12 steps");
  for (const [i, s] of steps.entries()) {
    if (!s.templateId && !s.bodyOverrideMd?.trim()) {
      throw fail("VALIDATION", `Step ${i + 1} needs a template or inline body`);
    }
    if ((s.delayBusinessDays ?? 0) < 0 || (s.delayBusinessDays ?? 0) > 30) {
      throw fail("VALIDATION", `Step ${i + 1} delay must be 0–30 business days`);
    }
  }
  await db.delete(sequenceSteps).where(eq(sequenceSteps.sequenceId, sequenceId));
  if (!steps.length) return;
  await db.insert(sequenceSteps).values(
    steps.map((s, i) => ({
      sequenceId,
      position: i,
      templateId: s.templateId || null,
      subjectOverride: s.subjectOverride?.slice(0, 150) || null,
      bodyOverrideMd: s.bodyOverrideMd || null,
      delayBusinessDays: s.delayBusinessDays ?? 3,
    })),
  );
  await audit(ctx, "sequence.steps", "sequence", sequenceId, { count: steps.length });
}

export async function setSequenceStatus(ctx: Ctx, id: string, status: "ACTIVE" | "PAUSED" | "DRAFT" | "ARCHIVED") {
  requireRole(ctx, ["OWNER", "ADMIN"]);
  const { sequence, steps } = await getSequence(ctx, id);

  if (status === "ACTIVE") {
    if (!steps.length) throw fail("VALIDATION", "Add at least one step before activating", 422);
    for (const s of steps) {
      const subject = s.step.subjectOverride ?? s.templateSubject;
      const body = s.step.bodyOverrideMd ?? s.templateBody;
      if (!subject || !body) throw fail("VALIDATION", `Step ${s.step.position + 1} is not fully renderable`, 422);
    }
  }
  if (status === "ARCHIVED") {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(enrollments)
      .where(and(eq(enrollments.sequenceId, id), eq(enrollments.status, "ACTIVE")));
    if ((row?.count ?? 0) > 0) throw fail("VALIDATION", "Cannot archive a sequence with active enrollments", 422);
  }
  if (status === "PAUSED") {
    await db
      .update(enrollments)
      .set({ status: "PAUSED", nextSendAt: null })
      .where(and(eq(enrollments.sequenceId, id), eq(enrollments.status, "ACTIVE")));
  }
  if (status === "ACTIVE" && sequence.status === "PAUSED") {
    await db
      .update(enrollments)
      .set({ status: "ACTIVE", nextSendAt: nextWindowStart(new Date()) })
      .where(and(eq(enrollments.sequenceId, id), eq(enrollments.status, "PAUSED")));
  }

  const [row] = await db.update(sequences).set({ status, updatedAt: new Date() }).where(eq(sequences.id, id)).returning();
  await audit(ctx, `sequence.${status.toLowerCase()}`, "sequence", id);
  return row;
}

/* ── preflight & enrollment ─────────────────────────────────────────────── */

export type PreflightRow = {
  id: string;
  business_name: string;
  email: string | null;
  stage: string;
  eligible: boolean;
  reasons: string[];
};

export async function preflight(ctx: Ctx, sequenceId: string, prospectIds: string[]) {
  const { sequence } = await getSequence(ctx, sequenceId);
  const ids = prospectIds.slice(0, 5000);
  const rows: PreflightRow[] = [];

  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const hydrated = await Promise.all(chunk.map((id) => getProspect(ctx, id).catch(() => null)));
    for (const p of hydrated) {
      if (!p) continue;
      const missing = enrollmentMissing(p);
      const reasons = missing.map((m) => m.key.replace(/_/g, " "));
      rows.push({
        id: p.id,
        business_name: p.business_name,
        email: p.contact_email ?? null,
        stage: p.stage,
        eligible: reasons.length === 0 && sequence.status === "ACTIVE",
        reasons: sequence.status === "ACTIVE" ? reasons : [...reasons, "sequence is not active"],
      });
    }
  }

  const summary: Record<string, number> = {};
  for (const r of rows) {
    if (r.eligible) continue;
    for (const reason of r.reasons) summary[reason] = (summary[reason] ?? 0) + 1;
  }
  return {
    total: rows.length,
    eligible: rows.filter((r) => r.eligible).length,
    skipped: rows.filter((r) => !r.eligible).length,
    summary,
    rows,
  };
}

export async function enroll(ctx: Ctx, sequenceId: string, prospectIds: string[], senderUserId?: string) {
  const { sequence } = await getSequence(ctx, sequenceId);
  if (sequence.status !== "ACTIVE") throw fail("SEQUENCE_INACTIVE", "Activate the sequence before enrolling", 422);

  const plan = await preflight(ctx, sequenceId, prospectIds);
  const eligible = plan.rows.filter((r) => r.eligible).map((r) => r.id);
  let enrolled = 0;
  const failures: { id: string; error: string }[] = [];

  for (const id of eligible) {
    try {
      const [row] = await db
        .insert(enrollments)
        .values({
          workspaceId: ctx.user.workspaceId,
          sequenceId,
          prospectId: id,
          status: "ACTIVE",
          currentStep: 0,
          nextSendAt: nextWindowStart(new Date()),
          enrolledBy: senderUserId || ctx.user.userId,
        })
        .onConflictDoNothing()
        .returning();
      if (!row) { failures.push({ id, error: "already enrolled" }); continue; }
      await enqueue(ctx.user.workspaceId, "SEND_STEP", { enrollmentId: row.id }, {
        dedupeKey: `send:${row.id}:0`,
      });
      enrolled++;
    } catch (err) {
      failures.push({ id, error: err instanceof Error ? err.message : "failed" });
    }
  }

  await audit(ctx, "sequence.enroll", "sequence", sequenceId, { requested: plan.total, enrolled, skipped: plan.skipped });
  return {
    enrolled,
    skipped: plan.skipped + failures.length,
    summary: plan.summary,
    rows: plan.rows,
    failures,
  };
}

export async function deleteSequence(ctx: Ctx, id: string) {
  requireRole(ctx, ["OWNER", "ADMIN"]);
  const [active] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(enrollments)
    .where(and(eq(enrollments.sequenceId, id), eq(enrollments.status, "ACTIVE")));
  if ((active?.count ?? 0) > 0) {
    throw fail("IN_USE", "Stop or complete active enrollments before deleting this sequence", 409);
  }
  await db.delete(sequences).where(and(eq(sequences.id, id), eq(sequences.workspaceId, ctx.user.workspaceId)));
  await audit(ctx, "sequence.delete", "sequence", id);
  return { ok: true };
}

export async function stopEnrollment(ctx: Ctx, id: string, reason = "manual") {  const [row] = await db
    .update(enrollments)
    .set({ status: "STOPPED", stopReason: reason, nextSendAt: null })
    .where(and(eq(enrollments.id, id), eq(enrollments.workspaceId, ctx.user.workspaceId)))
    .returning();
  if (!row) throw fail("NOT_FOUND", "Enrollment not found", 404);
  await audit(ctx, "enrollment.stop", "enrollment", id, { reason });
  return row;
}

export async function listEnrollments(ctx: Ctx, sequenceId?: string) {
  const where = sequenceId
    ? and(eq(enrollments.workspaceId, ctx.user.workspaceId), eq(enrollments.sequenceId, sequenceId))
    : eq(enrollments.workspaceId, ctx.user.workspaceId);
  return db
    .select({
      id: enrollments.id, status: enrollments.status, currentStep: enrollments.currentStep,
      nextSendAt: enrollments.nextSendAt, stopReason: enrollments.stopReason,
      sequenceName: sequences.name, sequenceId: sequences.id,
      businessName: prospects.businessName, prospectId: prospects.id, email: prospects.contactEmail,
    })
    .from(enrollments)
    .innerJoin(sequences, eq(sequences.id, enrollments.sequenceId))
    .innerJoin(prospects, eq(prospects.id, enrollments.prospectId))
    .where(where)
    .orderBy(desc(enrollments.createdAt))
    .limit(200);
}
