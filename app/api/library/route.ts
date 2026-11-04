import { route } from "@/lib/api";
import { listOffers, listRules, listTemplates } from "@/lib/services/library";

export const GET = route(async (_req, _ctx, ctx) => ({
  offers: await listOffers(ctx),
  templates: await listTemplates(ctx),
  qualificationRules: await listRules(ctx),
}));
