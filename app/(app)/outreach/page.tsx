import { PageHeader } from "@/components/page-header";
import { OutreachDraftEditor } from "@/components/outreach-draft-editor";
import { getSession } from "@/lib/auth/session";
import { listProspects } from "@/lib/services/prospects";

export const metadata = { title: "Outreach" };

export default async function OutreachPage() {
  const user = await getSession();
  if (!user) return null;
  const result = await listProspects(
    { user },
    { pageSize: 200, sort: "business" },
  );
  const prospects = result.rows.map((prospect) => ({
    id: prospect.id,
    businessName: prospect.business_name,
    email: prospect.contact_email ?? null,
  }));
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <PageHeader
        title="Outreach"
        description="Prepare and save a first email without sending it."
      />
      <OutreachDraftEditor prospects={prospects} />
    </div>
  );
}
