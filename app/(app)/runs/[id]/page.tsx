import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/auth/session";

export default async function RunDetailPage() {
  const user = await getSession();
  if (!user) return null;
  return (
    <AppShell user={user} notifications={[]}>
      <h2 className="text-[15px] font-semibold tracking-tight">Run</h2>
      <p className="mt-1 text-[12.5px] text-muted-foreground">Run detail, counters and sample items.</p>
    </AppShell>
  );
}
