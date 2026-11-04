import { reports } from "@/lib/services/analytics";
import { getSession } from "@/lib/auth/session";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  const user = await getSession();
  if (!user) return null;
  const data = await reports({ user });

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight">Reports</h2>
        <p className="mt-1 text-[12px] text-muted-foreground">Deliverability, source yield and pipeline analytics.</p>
      </div>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <h3 className="text-[13px] font-semibold tracking-tight">Deliverability</h3>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Sent" value={data.deliverability.sent} />
          <Stat label="Opened" value={data.deliverability.opened} />
          <Stat label="Clicked" value={data.deliverability.clicked} />
          <Stat label="Bounced" value={data.deliverability.bounced} />
          <Stat label="Failed" value={data.deliverability.failed} />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <h3 className="text-[13px] font-semibold tracking-tight">Pipeline by stage</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {data.pipeline.map((p) => (
            <div key={p.stage} className="rounded-lg border border-border px-3 py-2">
              <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{p.stage}</p>
              <p className="text-[16px] font-semibold">{p.count}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <h3 className="text-[13px] font-semibold tracking-tight">Source yield</h3>
        <div className="mt-3 overflow-hidden rounded-lg border border-border">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-3 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Source</th>
                <th className="px-3 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Runs</th>
                <th className="px-3 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Imported</th>
                <th className="px-3 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Qualified</th>
              </tr>
            </thead>
            <tbody>
              {data.sources.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{s.name}</td>
                  <td className="px-3 py-2">{s.runs}</td>
                  <td className="px-3 py-2">{s.imported}</td>
                  <td className="px-3 py-2">{s.qualified}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-0.5 text-[18px] font-semibold">{value}</p>
    </div>
  );
}
