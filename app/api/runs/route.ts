import { route } from "@/lib/api";
import { listRuns } from "@/lib/services/sources";

export const GET = route(async (_req, _ctx, ctx) => listRuns(ctx));
