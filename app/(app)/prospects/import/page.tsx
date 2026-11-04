import { ImportWizard } from "@/components/import-wizard";
import { PageHeader } from "@/components/page-header";
import { getSession } from "@/lib/auth/session";

export const metadata = { title: "Import prospects" };

export default async function ImportPage() {
  const user = await getSession();
  if (!user) return null;
  return (
    <>
      <PageHeader
        title="Import prospects"
        description="Add businesses from a file, map the fields and review the result before they enter your workspace."
      />
      <ImportWizard />
    </>
  );
}
