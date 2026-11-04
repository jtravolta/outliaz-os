import { publicRoute } from "@/lib/api";
import { readUnsubscribeToken, handleUnsubscribe } from "@/lib/services/replies";

export const POST = publicRoute(async (req) => {
  let token: string | null = null;
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => null);
    token = typeof body?.token === "string" ? body.token : null;
  } else {
    const form = await req.formData().catch(() => null);
    token = (form?.get("token") as string | null) ?? null;
  }
  const tokenStr = token ?? "";
  const parsed = readUnsubscribeToken(tokenStr);
  if (!parsed) {
    return Response.json({ error: { code: "INVALID_TOKEN", message: "That unsubscribe link is not valid" } }, { status: 400 });
  }
  const ok = await handleUnsubscribe(parsed);
  return { ok };
});
