import { AppShell } from "@/components/app-shell";
import { ImportWizard } from "@/components/import-wizard";
import { getSession } from "@/lib/auth/session";

export default async function ImportPage() {
  const user = await getSession();
  if (!user) return null;
  return (
    <AppShell user={user} notifications={[]}>
      <h2 className="mb-4 text-[15px] font-semibold tracking-tight">Import prospects</h2>
      <ImportWizard />
    </AppShell>
  );
}
