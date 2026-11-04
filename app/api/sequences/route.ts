import { json, route } from "@/lib/api";
import { createSequence, listSequences, type StepInput } from "@/lib/services/sequences";

export const GET = route(async (_req, _ctx, ctx) => listSequences(ctx));

export const POST = route(async (req, _ctx, ctx) => {
  const body = await json<{ name?: string; description?: string; steps?: StepInput[] }>(req);
  return createSequence(ctx, { name: body.name ?? "", description: body.description, steps: body.steps });
});
