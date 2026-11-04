import { route } from "@/lib/api";
import { listIntegrations } from "@/lib/services/settings";

export const GET = route(async (_req, _ctx, ctx) => listIntegrations(ctx));
