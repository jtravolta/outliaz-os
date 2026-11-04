import { json, route, type RouteContext } from "@/lib/api";
import {
  deleteProspect, duplicateCandidates, getProspectDetail, updateProspect,
} from "@/lib/services/prospects";

type P = { id: string };

export const GET = route<P>(async (_req, context: RouteContext<P>, ctx) => {
  const { id } = await context.params;
  const detail = await getProspectDetail(ctx, id);
  const duplicates = await duplicateCandidates(ctx, id);
  return { ...detail, duplicates };
});

export const PATCH = route<P>(async (req, context: RouteContext<P>, ctx) => {
  const { id } = await context.params;
  const body = await json<Record<string, unknown>>(req);
  const row = await updateProspect(ctx, id, body as never);
  return getProspectDetail(ctx, row.id);
});

export const DELETE = route<P>(async (_req, context: RouteContext<P>, ctx) => {
  const { id } = await context.params;
  return deleteProspect(ctx, id);
});
