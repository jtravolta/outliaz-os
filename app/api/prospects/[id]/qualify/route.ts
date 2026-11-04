import { json, route, type RouteContext } from "@/lib/api";
import { getProspect, getProspectDetail, transitionProspect } from "@/lib/services/prospects";
import { qualificationMissing, researchMissing } from "@/lib/taxonomy/gates";
import { fail } from "@/lib/services/common";

type P = { id: string };

/** Promote through the research or qualification gates. */
export const POST = route<P>(async (req, context: RouteContext<P>, ctx) => {
  const { id } = await context.params;
  const body = await json<{ to?: "RESEARCHED" | "QUALIFIED"; override?: boolean; reason?: string }>(req);
  const p = await getProspect(ctx, id);
  const to = body.to ?? (p.stage === "NEW" ? "RESEARCHED" : "QUALIFIED");

  const missing = to === "RESEARCHED" ? researchMissing(p) : qualificationMissing(p);
  if (missing.length && !body.override) {
    throw fail(to === "RESEARCHED" ? "RESEARCH_GATE" : "QUALIFICATION_GATE", "Gate is not complete", 422, {
      missing: missing.map((m) => m.key),
    });
  }

  await transitionProspect(ctx, id, to, { reason: body.reason, override: body.override });
  return getProspectDetail(ctx, id);
});
