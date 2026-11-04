import { PageHeader } from "@/components/page-header";
import { getSession } from "@/lib/auth/session";

export const metadata = { title: "Setup" };

export default async function SetupPage() {
  const user = await getSession();
  if (!user) return null;
  return (
    <>
      <PageHeader title="Setup" description="Workspace configuration wizard." />
    </>
  );
}
