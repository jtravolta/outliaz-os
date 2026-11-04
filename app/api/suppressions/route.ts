import { json, q, route } from "@/lib/api";
import { addSuppressions, listSuppressions } from "@/lib/services/settings";

export const GET = route(async (req, _ctx, ctx) => listSuppressions(ctx, q(req, "q")));

export const POST = route(async (req, _ctx, ctx) => {
  const body = await json<{ emails?: string[]; email?: string; reason?: string; note?: string }>(req);
  const emails = body.emails ?? (body.email ? body.email.split(/[\s,;]+/) : []);
  return addSuppressions(ctx, { emails, reason: body.reason, note: body.note });
});
