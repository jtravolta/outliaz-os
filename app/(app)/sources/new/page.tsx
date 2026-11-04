import { PageHeader } from "@/components/page-header";
import { getSession } from "@/lib/auth/session";

export const metadata = { title: "New source" };

export default async function NewSourcePage() {
  const user = await getSession();
  if (!user) return null;
  return (
    <>
      <PageHeader
        title="New source"
        description="Configure an Apify actor or an integration feed."
      />
    </>
  );
}
