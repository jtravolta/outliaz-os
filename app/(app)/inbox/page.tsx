import Link from "next/link";
import { listInbox } from "@/lib/services/replies";
import { getSession } from "@/lib/auth/session";
import { StatusPill } from "@/components/status-pill";

export const metadata = { title: "Inbox" };

export default async function InboxPage() {
  const user = await getSession();
  if (!user) return null;
  const replies = await listInbox({ user });

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">Inbox</h2>
          <p className="mt-1 text-[12px] text-muted-foreground">Inbound replies via IMAP, with response actions.</p>
        </div>
        <Link href="/inbox" className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 h-9 text-[13px] font-medium text-primary-foreground hover:brightness-110">
          + New reply
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="px-3 py-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">From</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Subject</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Business</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Stage</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Outcome</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Received</th>
            </tr>
          </thead>
          <tbody>
            {replies.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-[13px] text-muted-foreground">No replies yet.</td>
              </tr>
            )}
            {replies.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-3 py-2.5">{r.fromEmail}</td>
                <td className="px-3 py-2.5 font-medium">{r.subject}</td>
                <td className="px-3 py-2.5">{r.businessName ?? "Unknown sender"}</td>
                <td className="px-3 py-2.5">{r.stage ?? "—"}</td>
                <td className="px-3 py-2.5">{r.outcome ?? "—"}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{r.receivedAt ? new Date(r.receivedAt).toISOString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
