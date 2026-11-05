import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { CookieMethodsServer } from "@supabase/ssr";

type NextCookieStore = {
  getAll: () => { name: string; value: string }[];
  set: (name: string, value: string, options?: object) => unknown;
};

function getPublicSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is required");
  if (!key) throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required");

  return { url, key };
}

export async function createServerSupabaseClient(
  requestCookies?: NextCookieStore,
) {
  const { url, key } = getPublicSupabaseConfig();
  const cookieStore = (requestCookies ?? (await cookies())) as NextCookieStore;

  const cookieAdapter: CookieMethodsServer = {
    getAll: () => cookieStore.getAll(),
    setAll: (cookiesToSet) => {
      try {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      } catch {
        // Server components cannot mutate cookies; middleware and route handlers can.
      }
    },
  };

  return createServerClient(url, key, {
    cookies: cookieAdapter,
  });
}
