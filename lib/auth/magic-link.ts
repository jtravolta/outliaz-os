import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { json } from "@/lib/api";
import { getSupabaseSessionUser, type SessionUser } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/services/common";

export type SignInDependencies = {
  signInWithOtp: (args: { email: string; options: { emailRedirectTo: string } }) => Promise<{ error: unknown }>;
  appUrl?: string;
};

export async function handleSignIn(req: Request, dependencies?: SignInDependencies) {
  const { email } = await json<{ email?: string }>(req as NextRequest);
  const normalized = email?.trim().toLowerCase();
  if (!normalized) throw new AppError("VALIDATION", "Enter your email address", 400);

  const appUrl = (dependencies?.appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const client = dependencies?.signInWithOtp ?? (await createServerSupabaseClient()).auth.signInWithOtp;
  try {
    await client({ email: normalized, options: { emailRedirectTo: `${appUrl}/auth/callback` } });
  } catch {
    // Keep the response indistinguishable for unknown, rate-limited, and failed addresses.
  }
  return { ok: true };
}

export type CallbackDependencies = {
  exchangeCodeForSession: (code: string) => Promise<{ error: unknown }>;
  resolveUser: () => Promise<SessionUser | null>;
  signOut: () => Promise<{ error: unknown }>;
};

function denied(request: Request) {
  return NextResponse.redirect(new URL("/login?error=access_denied", request.url));
}

export async function handleCallback(request: Request, dependencies?: CallbackDependencies) {
  const code = new URL(request.url).searchParams.get("code");
  if (!code) return denied(request);

  const supabase = dependencies ? undefined : await createServerSupabaseClient();
  const exchangeCodeForSession = dependencies?.exchangeCodeForSession ??
    ((value: string) => supabase!.auth.exchangeCodeForSession(value));
  const resolveUser = dependencies?.resolveUser ?? (() => getSupabaseSessionUser(supabase));
  const signOut = dependencies?.signOut ?? (() => supabase!.auth.signOut());

  try {
    const { error } = await exchangeCodeForSession(code);
    if (error || !(await resolveUser())) {
      await signOut();
      return denied(request);
    }
  } catch {
    await signOut();
    return denied(request);
  }

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
