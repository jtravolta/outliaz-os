import { PageHeader } from "@/components/page-header";
import { getSession } from "@/lib/auth/session";

export const metadata = { title: "New prospect" };

export default async function NewProspectPage() {
  const user = await getSession();
  if (!user) return null;
  return (
    <>
      <PageHeader
        title="New prospect"
        description="Use the research drawer flow: create, research, qualify, then enroll."
      />
    </>
  );
}
