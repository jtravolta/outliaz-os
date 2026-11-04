import { publicRoute } from "@/lib/api";
import { db } from "@/lib/db/client";
import { workspaces } from "@/lib/db/schema";
import { healthCheck, retryDeadJobs, tick } from "@/lib/jobs/worker";

export const GET = publicRoute(async () => {
  const [ws] = await db.select().from(workspaces).limit(1);
  if (!ws) return { queue: { pending: 0, dead: 0 } };
  return { queue: await healthCheck(ws.id) };
});

export const POST = publicRoute(async (req) => {
  const body = await req.json().catch(() => ({}));
  const secret = req.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET;
  if (expected && secret !== expected) {
    return Response.json({ error: { code: "FORBIDDEN", message: "Bad cron secret" } }, { status: 403 });
  }
  const limit = Number(body?.limit ?? 20);
  const result = await tick(limit);
  const [ws] = await db.select().from(workspaces).limit(1);
  if (result.results.some((r) => !r.ok) && ws) await retryDeadJobs(ws.id);
  return result;
});
