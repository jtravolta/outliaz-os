import type { NextRequest } from "next/server";

import { json, publicRoute } from "@/lib/api";
import { setSessionCookie, signInWithEmail } from "@/lib/auth/session";
import { AppError } from "@/lib/services/common";

export const POST = publicRoute(async (req: NextRequest) => {
  const { email } = await json<{ email?: string }>(req);
  if (!email?.trim()) throw new AppError("VALIDATION", "Enter your email address", 400);
  const session = await signInWithEmail(email);
  if (!session) {
    throw new AppError("INVITE_ONLY", "This workspace is invite-only. Ask an owner to add your email.", 401);
  }
  await setSessionCookie(session);
  return { user: session };
});
