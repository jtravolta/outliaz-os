import { json, route } from "@/lib/api";
import { inviteUser } from "@/lib/services/settings";

export const POST = route(async (req, _ctx, ctx) => {
  const body = await json<{ email?: string; name?: string; role?: string }>(req);
  return inviteUser(ctx, { email: body.email ?? "", name: body.name, role: body.role });
});
