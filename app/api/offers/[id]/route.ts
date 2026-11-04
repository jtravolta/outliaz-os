import { json, route, type RouteContext } from "@/lib/api";
import { deleteOffer, updateOffer, type OfferInput } from "@/lib/services/library";

type P = { id: string };

export const PATCH = route<P>(async (req, context: RouteContext<P>, ctx) => {
  const { id } = await context.params;
  const body = await json<Partial<OfferInput>>(req);
  return updateOffer(ctx, id, body);
});

export const DELETE = route<P>(async (_req, context: RouteContext<P>, ctx) => {
  const { id } = await context.params;
  return deleteOffer(ctx, id);
});
