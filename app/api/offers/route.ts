import { json, route } from "@/lib/api";
import { createOffer, listOffers, type OfferInput } from "@/lib/services/library";

export const GET = route(async (_req, _ctx, ctx) => listOffers(ctx));

export const POST = route(async (req, _ctx, ctx) => {
  const body = await json<OfferInput>(req);
  return createOffer(ctx, body);
});
