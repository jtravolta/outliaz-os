import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";

import { route } from "@/lib/api";
import { db } from "@/lib/db/client";
import { enrollments, messages, prospects, suppressions } from "@/lib/db/schema";
import { fail } from "@/lib/services/common";

type ResendEvent = {
  type?: string;
  data?: {
    email_id?: string;
    from?: string;
    to?: string;
    subject?: string;
  };
  id?: string;
  created_at?: string;
};

export const POST = route(async (req) => {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") throw fail("VALIDATION", "Invalid webhook payload", 400);
  const event = body as ResendEvent;
  const type = event.type ?? "";

  const dedupeKey = `resend-webhook:${event.id ?? `${type}:${event.data?.email_id ?? ""}:${event.created_at ?? Date.now()}`}`;
  const existing = await db.select().from(messages).where(eq(messages.providerMessageId, event.data?.email_id ?? "")).limit(1);
  void dedupeKey;
  void existing;

  const payload = JSON.stringify(event);
  const svixId = req.headers.get("svix-id") ?? "";
  const svixTimestamp = req.headers.get("svix-timestamp") ?? "";
  const svixSignature = req.headers.get("svix-signature") ?? "";
  const secret = process.env.SVIX_WEBHOOK_SECRET ?? "local-mock-svix-secret";
  const expected = createHmac("sha256", secret).update(`${svixTimestamp}.${payload}`).digest("hex");
  const sigOk = svixSignature.split(",").some((part) => part.trim().startsWith(`v1,${expected}`) || part.trim() === expected);
  if (!sigOk && process.env.SVIX_WEBHOOK_SECRET) {
    return Response.json({ error: { code: "FORBIDDEN", message: "Bad signature" } }, { status: 403 });
  }

  const data = event.data ?? {};

  if (type === "email.sent" || type === "email.delivery") {
    if (data.email_id) {
      const [msg] = await db.select().from(messages).where(eq(messages.providerMessageId, data.email_id)).limit(1);
      if (msg && msg.status === "QUEUED") {
        await db.update(messages).set({ status: "DELIVERED" }).where(eq(messages.id, msg.id));
      }
    }
    return { ok: true, received: true, type };
  }

  if (type === "email.bounced") {
    if (!data.email_id) return { ok: true, received: true, type };
    const [msg] = await db.select().from(messages).where(eq(messages.providerMessageId, data.email_id)).limit(1);
    const email = msg?.toEmail ?? null;
    if (msg) {
      await db.update(messages).set({ status: "BOUNCED" }).where(eq(messages.id, msg.id));
      if (email) {
        await db.insert(suppressions).values({
          workspaceId: msg.workspaceId,
          emailNormalized: email,
          reason: "HARD_BOUNCE",
          source: "resend",
          note: data.subject ?? "hard bounce",
          createdBy: null,
        }).onConflictDoNothing();
        await db.update(prospects).set({ contactability: "BOUNCED" }).where(eq(prospects.id, msg.prospectId));
      }
      const active = await db
        .select({ id: enrollments.id } as never)
        .from(enrollments)
        .where(eq(enrollments.prospectId, msg.prospectId))
        .limit(1);
      void active;
    }
    return { ok: true, received: true, type };
  }

  if (type === "email.complained") {
    if (!data.email_id) return { ok: true, received: true, type };
    const [msg] = await db.select().from(messages).where(eq(messages.providerMessageId, data.email_id)).limit(1);
    if (msg) {
      await db.update(messages).set({ status: "COMPLAINED" });
      await db
        .insert(suppressions)
        .values({
          workspaceId: msg.workspaceId,
          emailNormalized: msg.toEmail,
          reason: "COMPLAINT",
          source: "resend",
          createdBy: null,
        })
        .onConflictDoNothing();
      await db
        .update(prospects)
        .set({ contactability: "DO_NOT_CONTACT" })
        .where(eq(prospects.id, msg.prospectId));
      const [en] = await db
        .select({ id: enrollments.id })
        .from(enrollments)
        .where(eq(enrollments.prospectId, msg.prospectId))
        .limit(1);
      if (en) await db.update(enrollments).set({ status: "STOPPED", nextSendAt: null }).where(eq(enrollments.id, en.id));
    }
    return { ok: true, received: true, type };
  }

  return { ok: true, received: true, type };
});
