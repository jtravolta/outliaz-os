import { route } from "@/lib/api";
import { dashboard } from "@/lib/services/analytics";

export const GET = route(async (_req, _ctx, ctx) => dashboard(ctx));
