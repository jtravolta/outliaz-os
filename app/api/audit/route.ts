import { q, qNum, route } from "@/lib/api";
import { listAudit } from "@/lib/services/settings";

export const GET = route(async (req, _ctx, ctx) =>
  listAudit(ctx, { action: q(req, "action"), userId: q(req, "userId"), page: qNum(req, "page") }),
);
