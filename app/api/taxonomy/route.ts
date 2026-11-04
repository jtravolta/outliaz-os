import { route } from "@/lib/api";
import { getTaxonomy } from "@/lib/services/settings";

export const GET = route(async (_req, _ctx, ctx) => getTaxonomy(ctx));
