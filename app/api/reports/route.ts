import { route } from "@/lib/api";
import { reports } from "@/lib/services/analytics";

export const GET = route(async (_req, _ctx, ctx) => reports(ctx));
