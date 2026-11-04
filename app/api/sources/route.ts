import { json, route } from "@/lib/api";
import { createSource, listSources, type SourceInput } from "@/lib/services/sources";
import { getTaxonomy } from "@/lib/services/settings";

export const GET = route(async (_req, _ctx, ctx) => {
  const [sources, taxonomy] = await Promise.all([listSources(ctx), getTaxonomy(ctx)]);
  return { sources, taxonomy };
});

export const POST = route(async (req, _ctx, ctx) => {
  const body = await json<SourceInput>(req);
  return createSource(ctx, body);
});
