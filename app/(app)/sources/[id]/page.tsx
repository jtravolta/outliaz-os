import { PageHeader } from "@/components/page-header";
import { getSession } from "@/lib/auth/session";

export const metadata = { title: "Source" };

export default async function SourceDetailPage() {
  const user = await getSession();
  if (!user) return null;
  return (
    <>
      <PageHeader
        title="Source"
        description="Source detail, runs and configuration."
      />
    </>
  );
}
