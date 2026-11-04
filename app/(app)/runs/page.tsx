import { db } from "@/lib/db/client";
import { listRuns } from "@/lib/services/sources";
import { getSession } from "@/lib/auth/session";
import { StatusPill } from "@/components/status-pill";

export const metadata = { title: "Runs" };

export default async function RunsPage() {
  const user = await getSession();
  if (!user) return null;
  const runs = await listRuns({ user });

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight">Runs</h2>
        <p className="mt-1 text-[12px] text-muted-foreground">Apify actor runs, imports and their outcomes.</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="px-3 py-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Source</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Status</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Fetched</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Imported</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Qualified</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Finished</th>
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-[13px] text-muted-foreground">No runs yet.</td>
              </tr>
            )}
            {runs.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-3 py-2.5 font-medium">{r.sourceName}</td>
                <td className="px-3 py-2.5"><StatusPill status={r.status} /></td>
                <td className="px-3 py-2.5">{r.itemsFetched}</td>
                <td className="px-3 py-2.5">{r.itemsImported}</td>
                <td className="px-3 py-2.5">{r.itemsQualified}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{r.finishedAt ? new Date(r.finishedAt).toISOString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
