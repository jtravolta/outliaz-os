import { PageHeader } from "@/components/page-header";
import { getSession } from "@/lib/auth/session";

export const metadata = { title: "Run" };

export default async function RunDetailPage() {
  const user = await getSession();
  if (!user) return null;
  return (
    <>
      <PageHeader
        title="Run"
        description="Run detail, counters and sample items."
      />
    </>
  );
}
