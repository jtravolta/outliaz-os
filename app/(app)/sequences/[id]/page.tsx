import { PageHeader } from "@/components/page-header";
import { getSession } from "@/lib/auth/session";

export const metadata = { title: "Sequence" };

export default async function SequenceDetailPage() {
  const user = await getSession();
  if (!user) return null;
  return (
    <>
      <PageHeader
        title="Sequence"
        description="Sequence builder, steps and enrollments."
      />
    </>
  );
}
