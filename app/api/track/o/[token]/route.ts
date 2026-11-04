import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";

import { publicRoute, type RouteContext } from "@/lib/api";
import { db } from "@/lib/db/client";
import { messages } from "@/lib/db/schema";
import { recordOpen } from "@/lib/services/replies";

type P = { token: string };

const secret = () => process.env.TRACKING_SECRET ?? "local-tracking-secret";

export const GET = publicRoute<P>(async (_req, ctx: RouteContext<P>) => {
  const { token } = await ctx.params;
  const raw = token?.split("?")[0] ?? "";
  const [body, sig] = raw.split(".");
  if (!body || !sig) return new Response("Bad token", { status: 400 });
  const expected = createHmac("sha256", secret()).update(body).digest("base64url").slice(0, 24);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !a.equals(b)) return new Response("Bad token", { status: 400 });

  const payload = Buffer.from(body, "base64url").toString("utf8");
  const [messageId, type] = payload.split(":");
  if (!messageId || type !== "o") return new Response("Bad token", { status: 400 });

  const row = await db.select().from(messages).where(eq(messages.id, messageId)).limit(1);
  if (!row[0]) return new Response("Not found", { status: 404 });

  await recordOpen(messageId);
  const pixel = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    "base64",
  );
  return new Response(new Uint8Array(pixel), {
    status: 1,
    headers: { "content-type": "image/gif", "cache-control": "no-store" },
  });
});
