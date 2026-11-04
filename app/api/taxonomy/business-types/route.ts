import { json, route } from "@/lib/api";
import { createBusinessType } from "@/lib/services/settings";

export const POST = route(async (req, _ctx, ctx) => {
  const body = await json<{ industrySlug?: string; label?: string }>(req);
  return createBusinessType(ctx, { industrySlug: body.industrySlug ?? "", label: body.label ?? "" });
});
