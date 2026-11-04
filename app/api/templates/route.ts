import { json, route } from "@/lib/api";
import { createTemplate, listTemplates, type TemplateInput } from "@/lib/services/library";

export const GET = route(async (_req, _ctx, ctx) => listTemplates(ctx));

export const POST = route(async (req, _ctx, ctx) => {
  const body = await json<TemplateInput>(req);
  return createTemplate(ctx, body);
});
