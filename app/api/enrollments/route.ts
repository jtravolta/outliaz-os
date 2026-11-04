import { q, route } from "@/lib/api";
import { listEnrollments } from "@/lib/services/sequences";

export const GET = route(async (req, _ctx, ctx) => listEnrollments(ctx, q(req, "sequenceId")));
