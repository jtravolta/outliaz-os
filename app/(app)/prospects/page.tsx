import { AppShell } from "@/components/app-shell";
import { ProspectsTable } from "@/components/prospects-table";
import { Plus } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { listProspects } from "@/lib/services/prospects";

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

  const result = await listProspects({ user }, {
    q: filters.q,
    stages: filters.stage?.split(",") as never,    industry: filters.industry,
    fit: filters.fit as never,
    priority: filters.priority as never,
    sort: (filters.sort as never) ?? "newest",
    page: Number(filters.page ?? 1),
    pageSize: Number(filters.pageSize ?? 50),
  });

  return (
    <AppShell user={user} notifications={[]}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">Prospects</h2>
          <p className="text-[12px] text-muted-foreground">{result.total} in workspace</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/prospects/import"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 h-9 text-[13px] font-medium hover:bg-muted"
          >
            <Plus className="size-3.5" /> Import
          </a>
          <a
            href="/prospects/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 h-9 text-[13px] font-medium text-primary-foreground hover:brightness-110"
          >
            <Plus className="size-3.5" /> New prospect
          </a>
        </div>
      </div>

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
    </AppShell>
  );
}
