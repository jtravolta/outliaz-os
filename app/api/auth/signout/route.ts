import { clearSessionCookie } from "@/lib/auth/session";
import { publicRoute } from "@/lib/api";

export const POST = publicRoute(async () => {
  await clearSessionCookie();
  return { ok: true };
});
