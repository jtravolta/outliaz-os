import Link from "next/link";
import { db } from "@/lib/db/client";
import { listSources } from "@/lib/services/sources";
import { getSession } from "@/lib/auth/session";
import { StatusPill } from "@/components/status-pill";

export const metadata = { title: "Sources" };

export default async function SourcesPage() {
  const user = await getSession();
  if (!user) return null;
  const sources = await listSources({ user });

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">Sources</h2>
          <p className="mt-1 text-[12px] text-muted-foreground">Scrapers and integrations that feed prospects into the pipeline.</p>
        </div>
        <Link
          href="/sources/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 h-9 text-[13px] font-medium text-primary-foreground hover:brightness-110"
        >
          + New source
        </Link>
      </div>

      {sources.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-[13px] text-muted-foreground">No sources yet. Create an Apify actor or integration source to start collecting leads.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sources.map((s) => (
            <Link
              key={s.id}
              href={`/sources/${s.id}`}
              className="rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-muted/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[14px] font-semibold">{s.name}</p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">{s.actorName ?? s.actorId ?? "apify"}</p>
                </div>
                <StatusPill status={s.lastRunStatus ?? "NEVER"} />
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-[12px] text-muted-foreground">
                <span>Last run {s.lastRunAt ? new Date(s.lastRunAt).toISOString() : "—"}</span>
                <span>{s.runCount} runs</span>
                <span>{s.importedTotal} imported</span>
                <span className="capitalize">{s.schedule ?? "manual"}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
