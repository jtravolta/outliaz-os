import { publicRoute } from "@/lib/api";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const POST = publicRoute(async () => {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  return { ok: true };
});
