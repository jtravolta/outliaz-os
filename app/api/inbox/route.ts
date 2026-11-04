import { q, qBool, route } from "@/lib/api";
import { listInbox } from "@/lib/services/replies";

export const GET = route(async (req, _ctx, ctx) =>
  listInbox(ctx, {
    unread: qBool(req, "unread"),
    mine: qBool(req, "mine"),
    outcome: q(req, "outcome"),
    q: q(req, "q"),
  }),
);
