import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ProspectsTable } from "@/components/prospects-table";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";
import { listProspects } from "@/lib/services/prospects";
import { Plus, Upload } from "lucide-react";

export const metadata = { title: "Prospects" };

export default async function ProspectsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = (await searchParams) as Record<string, string>;
  const user = await getSession();
  if (!user) return null;

  const filters: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string" && v) filters[k] = v;
  }

  const result = await listProspects(
    { user },
    {
      q: filters.q,
      stages: filters.stage?.split(",") as never,
      industry: filters.industry,
      fit: filters.fit as never,
      priority: filters.priority as never,
      sort: (filters.sort as never) ?? "newest",
      page: Number(filters.page ?? 1),
      pageSize: Number(filters.pageSize ?? 50),
    },
  );

  return (
    <>
      <PageHeader
        title="Prospects"
        description="Research the right businesses. Keep the next action clear."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/prospects/import">
                <Upload aria-hidden="true" /> Import
              </Link>
            </Button>
            <Button asChild>
              <Link href="/prospects/new">
                <Plus aria-hidden="true" /> New prospect
              </Link>
            </Button>
          </>
        }
      />

      <ProspectsTable
        initialRows={result.rows}
        initialTotal={result.total}
        initialFilters={{
          q: filters.q ?? "",
          stage: filters.stage ?? "",
          industry: filters.industry ?? "",
          fit: filters.fit ?? "",
          priority: filters.priority ?? "",
          sort: filters.sort ?? "newest",
          page: filters.page ?? "1",
        }}
      />
    </>
  );
}
