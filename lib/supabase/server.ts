import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { CookieMethodsServer } from "@supabase/ssr";

type RequestCookieStore = CookieMethodsServer;

function getPublicSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is required");
  if (!key) throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required");

  return { url, key };
}

export async function createServerSupabaseClient(
  requestCookies?: RequestCookieStore,
) {
  const { url, key } = getPublicSupabaseConfig();
  const cookieStore = requestCookies ?? (await cookies());

  return createServerClient(url, key, {
    cookies: cookieStore,
  });
}
