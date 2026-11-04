import Link from "next/link";
import { db } from "@/lib/db/client";
import { label } from "@/lib/taxonomy/enums";
import { StatusPill } from "@/components/status-pill";
import { getSession } from "@/lib/auth/session";
import { dashboard } from "@/lib/services/analytics";
import { PageHeader } from "@/components/page-header";

export default async function DashboardPage() {
  const user = await getSession();
  if (!user) return null;

  const data = await dashboard({ user });

  const cards = [
    {
      label: "Prospects",
      value: data.totals.total,
      hint: `+${data.totals.newThisWeek} new this week`,
    },
    {
      label: "Research queue",
      value: data.totals.researchQueue,
      hint: `${data.totals.qualifyQueue} to qualify`,
    },
    {
      label: "Sent · 7d",
      value: data.sending.sent7d,
      hint: `${data.replyRate}% reply rate`,
    },
    {
      label: "Follow-ups due",
      value: data.followUps.overdue + data.followUps.today,
      hint: `${data.followUps.overdue} overdue`,
    },
  ];

  return (
    <div className="mx-auto flex max-w-7xl min-w-0 flex-col gap-6 overflow-hidden">
      <PageHeader
        title="Today"
        description="Your pipeline, follow-ups and latest activity."
      />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-border bg-card p-4 shadow-sm"
          >
            <p className="text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">
              {c.label}
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">
              {c.value}
            </p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">{c.hint}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <h2 className="text-[13px] font-semibold tracking-tight">Pipeline</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {data.pipeline.map((p) => (
            <Link
              key={p.stage}
              href={`/prospects?stage=${p.stage}`}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 hover:bg-muted"
            >
              <span className="text-[12px] font-medium text-muted-foreground">
                {label("stage", p.stage)}
              </span>
              <span className="text-[14px] font-semibold">{p.count}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-[13px] font-semibold tracking-tight">
            Sent vs replies — last 30 days
          </h2>
          <Chart series={data.series} />
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-[13px] font-semibold tracking-tight">Queue</h2>
          <div className="mt-2 flex flex-col gap-2 text-[13px]">
            <p>
              <span className="font-semibold">{data.totals.newThisWeek}</span>{" "}
              prospects added in the last 7 days.
            </p>
            <p>
              <span className="font-semibold">{data.totals.researchQueue}</span>{" "}
              waiting on research.
            </p>
            <p>
              <span className="font-semibold">{data.totals.qualifyQueue}</span>{" "}
              waiting on qualification.
            </p>
            <p>
              <span className="font-semibold">{data.followUps.overdue}</span>{" "}
              follow-ups overdue.
            </p>
          </div>
          {data.jobs?.pending > 0 && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
              {data.jobs.pending} background jobs pending — the tick worker is
              running on the cron schedule.
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-[13px] font-semibold tracking-tight">
            Recent runs
          </h2>
          <div className="mt-2 space-y-2">
            {data.recentRuns.length === 0 && (
              <p className="text-[13px] text-muted-foreground">No runs yet.</p>
            )}
            {data.recentRuns.map((r) => (
              <Link
                key={r.id}
                href={`/runs/${r.id}`}
                className="block rounded-lg border border-border px-3 py-2 hover:bg-muted"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium">
                    {r.sourceName}
                  </span>
                  <StatusPill status={r.status} />
                </div>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  {r.itemsImported} imported · {r.itemsFetched} fetched
                </p>
              </Link>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-[13px] font-semibold tracking-tight">
            Latest replies
          </h2>
          <div className="mt-2 space-y-2">
            {data.recentReplies.length === 0 && (
              <p className="text-[13px] text-muted-foreground">
                No replies yet.
              </p>
            )}
            {data.recentReplies.map((r) => (
              <Link
                key={r.id}
                href={`/inbox/${r.id}`}
                className="block rounded-lg border border-border px-3 py-2 hover:bg-muted"
              >
                <p className="text-[13px] font-medium">
                  {r.businessName ?? "Unknown sender"}
                </p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  {r.snippet}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Chart({
  series,
}: {
  series: { day: string; sent: number; replies: number }[];
}) {
  const max = Math.max(1, ...series.map((s) => s.sent));
  const days = series.slice(-30);
  if (!days.length)
    return (
      <p className="mt-2 text-[13px] text-muted-foreground">No activity yet.</p>
    );
  return (
    <div className="mt-3 flex h-40 min-w-0 max-w-full items-end gap-1 overflow-hidden">
      {days.map((d) => (
        <div
          key={d.day}
          className="flex flex-1 flex-col items-center justify-end gap-1"
          title={`${d.day}: ${d.sent} sent, ${d.replies} replies`}
        >
          <div className="flex w-full items-end justify-center">
            <div
              className="w-1/2 rounded-t bg-primary"
              style={{ height: `${Math.max(4, (d.sent / max) * 100)}%` }}
            />
            <div
              className="w-1/2 rounded-t bg-muted"
              style={{ height: `${Math.max(4, (d.replies / max) * 100)}%` }}
            />
          </div>
          <span className="hidden text-[9px] text-muted-foreground sm:inline">
            {d.day.slice(5)}
          </span>
        </div>
      ))}
    </div>
  );
}
