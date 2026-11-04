import { json, route } from "@/lib/api";
import { listTeam } from "@/lib/services/settings";

export const GET = route(async (_req, _ctx, ctx) => listTeam(ctx));

export const POST = route(async (req, _ctx, ctx) => {
  const body = await json<{ email?: string; name?: string; role?: string }>(req);
  const { inviteUser } = await import("@/lib/services/settings");
  return inviteUser(ctx, { email: body.email ?? "", name: body.name, role: body.role });
});
