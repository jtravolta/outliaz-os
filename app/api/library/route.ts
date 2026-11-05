import { route } from "@/lib/api";
import { listOffers, listRules, listTemplates } from "@/lib/services/library";

export const GET = route(async (_req, _ctx, ctx) => {
  const [offers, templates, qualificationRules] = await Promise.all([
    listOffers(ctx),
    listTemplates(ctx),
    listRules(ctx),
  ]);
  return { offers, templates, qualificationRules };
});
