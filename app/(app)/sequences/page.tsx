import Link from "next/link";
import { listSequences } from "@/lib/services/sequences";
import { getSession } from "@/lib/auth/session";
import { StatusPill } from "@/components/status-pill";

export const metadata = { title: "Sequences" };

export default async function SequencesPage() {
  const user = await getSession();
  if (!user) return null;
  const sequences = await listSequences({ user });

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">Sequences</h2>
          <p className="mt-1 text-[12px] text-muted-foreground">Outbound email sequences and enrollments.</p>
        </div>
        <Link href="/sequences" className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 h-9 text-[13px] font-medium text-primary-foreground hover:brightness-110">
          + New sequence
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="px-3 py-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Name</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Status</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Steps</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Enrolled</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Active</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Replies</th>
            </tr>
          </thead>
          <tbody>
            {sequences.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-[13px] text-muted-foreground">No sequences yet.</td>
              </tr>
            )}
            {sequences.map((s) => (
              <tr key={s.id} className="border-t border-border">
                <td className="px-3 py-2.5 font-medium">{s.name}</td>
                <td className="px-3 py-2.5"><StatusPill status={s.status} /></td>
                <td className="px-3 py-2.5">{s.steps}</td>
                <td className="px-3 py-2.5">{s.enrolled}</td>
                <td className="px-3 py-2.5">{s.active}</td>
                <td className="px-3 py-2.5">{s.replies}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
