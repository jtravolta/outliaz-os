import { createHmac } from "node:crypto";
import { and, asc, eq, gte, inArray, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  businessTypes, emailTemplates, enrollments, integrationCredentials, messages, offers,
  prospectServices, prospects, sequenceSteps, sequences, suppressions, users, workspaces,
} from "@/lib/db/schema";
import { providers } from "@/lib/providers";
import { markdownToHtml, renderMergeFields, rewriteLinks, textFromMarkdown, trackToken, wrapEmailHtml } from "@/lib/email/render";
import { addBusinessDays, inSendWindow, nextWindowStart } from "@/lib/utils";
import { enqueue } from "@/lib/jobs/queue";

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

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

type SendContext = {
  enrollment: typeof enrollments.$inferSelect;
  sequence: typeof sequences.$inferSelect;
  prospect: typeof prospects.$inferSelect;
  workspace: typeof workspaces.$inferSelect;
};

async function loadContext(enrollmentId: string): Promise<SendContext | null> {
  const [row] = await db
    .select({ enrollment: enrollments, sequence: sequences, prospect: prospects, workspace: workspaces })
    .from(enrollments)
    .innerJoin(sequences, eq(sequences.id, enrollments.sequenceId))
    .innerJoin(prospects, eq(prospects.id, enrollments.prospectId))
    .innerJoin(workspaces, eq(workspaces.id, enrollments.workspaceId))
    .where(eq(enrollments.id, enrollmentId));
  return row ?? null;
}

const reschedule = async (ctx: SendContext, at: Date, reason: string) => {
  await db.update(enrollments).set({ nextSendAt: at, updatedAt: new Date() }).where(eq(enrollments.id, ctx.enrollment.id));
  await enqueue(ctx.enrollment.workspaceId, "SEND_STEP", { enrollmentId: ctx.enrollment.id }, {
    runAt: at,
    dedupeKey: `send:${ctx.enrollment.id}:${ctx.enrollment.currentStep}:${at.getTime()}`,
  });
  console.log(`[send] rescheduled ${ctx.prospect.businessName}: ${reason} → ${at.toISOString()}`);
};

async function stopEnrollment(ctx: SendContext, reason: string) {
  await db
    .update(enrollments)
    .set({ status: "STOPPED", stopReason: reason, nextSendAt: null })
    .where(eq(enrollments.id, ctx.enrollment.id));
}

export async function processSendStep(payload: { enrollmentId: string; force?: boolean }) {
  const ctx = await loadContext(payload.enrollmentId);
  if (!ctx) return;
  const { enrollment, sequence, prospect, workspace } = ctx;

  if (enrollment.status !== "ACTIVE" || sequence.status !== "ACTIVE") return;

  const terminal = ["WON", "LOST", "DISQUALIFIED"].includes(prospect.stage);
  if (terminal) return stopEnrollment(ctx, `stage_${prospect.stage.toLowerCase()}`);

  if (prospect.contactability !== "OK") return stopEnrollment(ctx, `contactability_${prospect.contactability.toLowerCase()}`);
  if (prospect.contactQuality === "BOUNCED") return stopEnrollment(ctx, "hard_bounce");
  const email = prospect.contactEmailNormalized;
  if (!email) return stopEnrollment(ctx, "no_email");

  const [suppressed] = await db
    .select({ id: suppressions.id })
    .from(suppressions)
    .where(and(eq(suppressions.workspaceId, workspace.id), eq(suppressions.emailNormalized, email)));
  if (suppressed) return stopEnrollment(ctx, "suppressed");

  // No email to the same prospect within 24 hours.
  const [recent] = await db
    .select({ sentAt: messages.sentAt })
    .from(messages)
    .where(and(eq(messages.prospectId, prospect.id), eq(messages.status, "SENT"), gte(messages.sentAt, new Date(Date.now() - 86_400_000))))
    .limit(1);
  if (recent && !payload.force) {
    return reschedule(ctx, new Date(Date.now() + 3_600_000), "24h contact rule");
  }

  if (!payload.force && !inSendWindow(new Date(), workspace.sendWindowStart, workspace.sendWindowEnd)) {
    return reschedule(ctx, nextWindowStart(new Date(), workspace.sendWindowStart, workspace.sendWindowEnd), "outside send window");
  }

  // Caps: per-user daily and per-workspace hourly.
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const [{ userToday }] = await db
    .select({ userToday: sql<number>`count(*)::int` })
    .from(messages)
    .innerJoin(enrollments, eq(enrollments.id, messages.enrollmentId))
    .where(and(
      eq(messages.workspaceId, workspace.id),
      eq(enrollments.enrolledBy, enrollment.enrolledBy ?? ""),
      eq(messages.status, "SENT"),
      gte(messages.sentAt, dayStart),
    ));

  const [{ workspaceHour }] = await db
    .select({ workspaceHour: sql<number>`count(*)::int` })
    .from(messages)
    .where(and(
      eq(messages.workspaceId, workspace.id),
      eq(messages.status, "SENT"),
      gte(messages.sentAt, new Date(Date.now() - 3_600_000)),
    ));

  let dailyCap = workspace.dailySendCap;
  const [credential] = await db
    .select({ verifiedAt: integrationCredentials.verifiedAt })
    .from(integrationCredentials)
    .where(and(eq(integrationCredentials.workspaceId, workspace.id), eq(integrationCredentials.kind, "RESEND")));
  if (credential?.verifiedAt && providers.resend.mode === "live") {
    const days = Math.max(1, Math.floor((Date.now() - credential.verifiedAt.getTime()) / 86_400_000));
    dailyCap = Math.min(workspace.dailySendCap, 5 * days);
  }

  if (userToday >= dailyCap) return reschedule(ctx, nextWindowStart(new Date(), workspace.sendWindowStart, workspace.sendWindowEnd), "daily cap reached");
  if (workspaceHour >= workspace.hourlySendCap) {
    return reschedule(ctx, new Date(Date.now() + 3_600_000), "hourly cap reached");
  }

  const [step] = await db
    .select({
      step: sequenceSteps,
      templateSubject: emailTemplates.subject,
      templateBody: emailTemplates.bodyMd,
      offerName: offers.name,
      offerValue: offers.valuePropMd,
    })
    .from(sequenceSteps)
    .leftJoin(emailTemplates, eq(emailTemplates.id, sequenceSteps.templateId))
    .leftJoin(offers, eq(offers.id, emailTemplates.offerId))
    .where(and(eq(sequenceSteps.sequenceId, sequence.id), eq(sequenceSteps.position, enrollment.currentStep)));

  if (!step) {
    await db.update(enrollments).set({ status: "COMPLETED", nextSendAt: null }).where(eq(enrollments.id, enrollment.id));
    return;
  }

  const [bt] = prospect.businessTypeId
    ? await db.select({ label: businessTypes.label }).from(businessTypes).where(eq(businessTypes.id, prospect.businessTypeId))
    : [];

  const svcRows = await db
    .select({ service: prospectServices.service })
    .from(prospectServices)
    .where(eq(prospectServices.prospectId, prospect.id));

  const mergeProspect = {
    stage: prospect.stage, industry_slug: prospect.industrySlug,
    business_type_id: prospect.businessTypeId, company_size: prospect.companySize,
    fit: prospect.fit, priority: prospect.priority, country_code: prospect.countryCode,
    contact_name: prospect.contactName, contact_role: prospect.contactRole,
    contact_email: prospect.contactEmail, contact_quality: prospect.contactQuality,
    contactability: prospect.contactability, business_name: prospect.businessName,
    contact_first_name: prospect.contactFirstName, contact_last_name: prospect.contactLastName,
    city: prospect.city, region: prospect.region, market: prospect.market,
    website: prospect.website, business_type_label: bt?.label ?? null,
    custom_fields: prospect.customFields,
  };

  const subjectRaw = step.step.subjectOverride ?? step.templateSubject ?? "";
  const bodyRaw = step.step.bodyOverrideMd ?? step.templateBody ?? "";
  const subject = renderMergeFields(subjectRaw, mergeProspect).text.slice(0, 200);
  const body = renderMergeFields(bodyRaw, mergeProspect).text;

  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "outreach@localhost";
  const fromName = process.env.RESEND_FROM_NAME ?? workspace.name;
  const replyTo = process.env.RESEND_REPLY_TO ?? fromEmail;

  const [message] = await db
    .insert(messages)
    .values({
      workspaceId: workspace.id,
      enrollmentId: enrollment.id,
      prospectId: prospect.id,
      stepId: step.step.id,
      toEmail: prospect.contactEmail!,
      fromEmail,
      subject,
      bodyMd: body,
      text: textFromMarkdown(body),
      status: "QUEUED",
      provider: "resend",
    })
    .returning();

  const app = appUrl();
  const pixelUrl = workspace.trackOpens ? `${app}/api/track/o/${trackToken(message.id, "o")}.gif` : undefined;
  let html = wrapEmailHtml(markdownToHtml(body), {
    footer: workspace.unsubscribeFooter ? workspace.footerText ?? "" : "",
    unsubscribeUrl: `${app}/u/${unsubscribeToken(prospect.contactEmail!, workspace.id)}`,
    pixelUrl,
  });
  if (workspace.trackClicks) html = rewriteLinks(html, message.id, app);

  const headers: Record<string, string> = {
    "List-Unsubscribe": `<${app}/u/${unsubscribeToken(prospect.contactEmail!, workspace.id)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
  if (step.offerName) headers["X-Offer"] = step.offerName;

  try {
    const sent = await providers.resend.sendEmail({
      to: prospect.contactEmail!,
      from: fromEmail,
      fromName,
      replyTo,
      subject,
      html,
      text: textFromMarkdown(body),
      headers,
    });

    const now = new Date();
    // In mock mode we light up the engagement funnel so reports/inbox have data.
    const mockOpen = providers.resend.mode === "mock" && Math.random() < 0.55;

    await db
      .update(messages)
      .set({
        status: mockOpen ? "DELIVERED" : "SENT",
        providerMessageId: sent.id,
        messageIdHeader: sent.messageId,
        html,
        sentAt: now,
        openedAt: mockOpen ? new Date(now.getTime() + 60_000) : null,
        openCount: mockOpen ? 1 + Math.floor(Math.random() * 3) : 0,
      })
      .where(eq(messages.id, message.id));

    await db
      .update(prospects)
      .set({
        lastContactedAt: now,
        contactQuality: prospect.contactQuality === "UNKNOWN" ? "UNVERIFIED" : prospect.contactQuality,
        stage:
          prospect.stage === "QUALIFIED" ? "CONTACTED"
          : prospect.stage === "CONTACTED" && enrollment.currentStep >= 1 ? "FOLLOW_UP"
          : prospect.stage,
        updatedAt: now,
      })
      .where(eq(prospects.id, prospect.id));

    const nextStep = enrollment.currentStep + 1;
    const stepCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sequenceSteps)
      .where(eq(sequenceSteps.sequenceId, sequence.id));

    if (nextStep >= (stepCount[0]?.count ?? 0)) {
      await db.update(enrollments).set({ status: "COMPLETED", currentStep: nextStep, nextSendAt: null }).where(eq(enrollments.id, enrollment.id));
    } else {
      const delay = step.step.delayBusinessDays;
      const jitter = Math.floor(Math.random() * 90) * 60_000;
      const at = nextWindowStart(addBusinessDays(new Date(), delay), workspace.sendWindowStart, workspace.sendWindowEnd);
      at.setTime(at.getTime() + jitter);
      await db.update(enrollments).set({ currentStep: nextStep, nextSendAt: at }).where(eq(enrollments.id, enrollment.id));
      await enqueue(workspace.id, "SEND_STEP", { enrollmentId: enrollment.id }, {
        runAt: at,
        dedupeKey: `send:${enrollment.id}:${nextStep}:${at.getTime()}`,
      });
    }
  } catch (err) {
    const failure = err instanceof Error ? err.message : "send failed";
    await db.update(messages).set({ status: "FAILED", error: failure }).where(eq(messages.id, message.id));
    await stopEnrollment(ctx, "send_failed");
    throw err;
  }
}

/** Send a one-off manual email (inbox reply / manual touch). */
export async function sendManualEmail(input: {
  workspaceId: string;
  prospectId: string;
  to: string;
  subject: string;
  body: string;
  userId: string;
}) {
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "outreach@localhost";
  const fromName = process.env.RESEND_FROM_NAME ?? "Acme Studio";
  const app = appUrl();
  const [message] = await db
    .insert(messages)
    .values({
      workspaceId: input.workspaceId,
      prospectId: input.prospectId,
      toEmail: input.to,
      fromEmail,
      subject: input.subject,
      bodyMd: input.body,
      text: textFromMarkdown(input.body),
      status: "QUEUED",
      isManual: true,
      provider: "resend",
    })
    .returning();

  const html = wrapEmailHtml(markdownToHtml(input.body), {
    footer: "Sent from the Acme Studio outbound workspace.",
    unsubscribeUrl: `${app}/u/${unsubscribeToken(input.to, input.workspaceId)}`,
  });

  const sent = await providers.resend.sendEmail({
    to: input.to, from: fromEmail, fromName, replyTo: process.env.RESEND_REPLY_TO ?? fromEmail,
    subject: input.subject, html, text: textFromMarkdown(input.body),
    headers: { "List-Unsubscribe": `<${app}/u/${unsubscribeToken(input.to, input.workspaceId)}>` },
  });

  await db
    .update(messages)
    .set({ status: "SENT", html, sentAt: new Date(), providerMessageId: sent.id, messageIdHeader: sent.messageId })
    .where(eq(messages.id, message.id));
  await db.update(prospects).set({ lastContactedAt: new Date() }).where(eq(prospects.id, input.prospectId));
  return message;
}

export async function suppressionSet(workspaceId: string, emails: string[]) {
  if (!emails.length) return new Set<string>();
  const rows = await db
    .select({ email: suppressions.emailNormalized })
    .from(suppressions)
    .where(and(eq(suppressions.workspaceId, workspaceId), inArray(suppressions.emailNormalized, emails)));
  return new Set(rows.map((r) => r.email));
}

export async function teamUsers(workspaceId: string) {
  return db.select({ id: users.id, name: users.name, email: users.email, role: users.role })
    .from(users)
    .where(and(eq(users.workspaceId, workspaceId), eq(users.status, "ACTIVE")))
    .orderBy(asc(users.name));
}
