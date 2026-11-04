import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/auth/session";

export default async function SequenceDetailPage() {
  const user = await getSession();
  if (!user) return null;
  return (
    <AppShell user={user} notifications={[]}>
      <h2 className="text-[15px] font-semibold tracking-tight">Sequence</h2>
      <p className="mt-1 text-[12.5px] text-muted-foreground">Sequence builder, steps and enrollments.</p>
    </AppShell>
  );
}
