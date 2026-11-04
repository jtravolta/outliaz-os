import { route } from "@/lib/api";
import { syncImap } from "@/lib/services/replies";

export const POST = route(async (_req, _ctx, ctx) => syncImap(ctx));
