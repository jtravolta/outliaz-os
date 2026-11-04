import { json, route } from "@/lib/api";
import { getWorkspace, updateWorkspace } from "@/lib/services/settings";

export const GET = route(async (_req, _ctx, ctx) => getWorkspace(ctx));

export const PATCH = route(async (req, _ctx, ctx) => {
  const body = await json<Record<string, unknown>>(req);
  return updateWorkspace(ctx, body);
});
