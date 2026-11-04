import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { formatWorkspaceDate } from "@/lib/format";
import { getSession } from "@/lib/auth/session";
import { listInbox } from "@/lib/services/replies";
import { label } from "@/lib/taxonomy/enums";

export const metadata = { title: "Inbox" };

export default async function InboxPage() {
  const user = await getSession();
  if (!user) return null;
  const replies = await listInbox({ user });
  return (
    <div className="mx-auto flex max-w-7xl min-w-0 flex-col gap-4">
      <PageHeader
        title="Inbox"
        description="Review inbound replies and decide the next action."
      />
      <div className="inbox-cards" aria-label="Replies">
        {replies.map((reply) => (
          <Link
            key={reply.id}
            href={`/inbox/${reply.id}`}
            className="inbox-card"
            aria-label={`Open reply from ${reply.businessName ?? reply.fromEmail}`}
          >
            <div>
              <strong>{reply.businessName ?? "Unknown sender"}</strong>
              <span>{reply.fromEmail}</span>
            </div>
            <div>
              <strong>{reply.subject || "(No subject)"}</strong>
              <span>{reply.snippet || "No preview available"}</span>
            </div>
            <StatusPill status={reply.outcome ?? "NEW"} />
            <time dateTime={reply.receivedAt.toISOString()}>
              {formatWorkspaceDate(reply.receivedAt)}
            </time>
          </Link>
        ))}
        {replies.length === 0 ? (
          <p className="empty-cell">No replies yet.</p>
        ) : null}
      </div>
      <div className="inbox-table overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              {[
                "From",
                "Subject",
                "Business",
                "Stage",
                "Outcome",
                "Received",
              ].map((heading) => (
                <th
                  key={heading}
                  className="px-3 py-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {replies.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-10 text-center text-muted-foreground"
                >
                  No replies yet.
                </td>
              </tr>
            ) : null}
            {replies.map((reply) => (
              <tr key={reply.id} className="border-t border-border">
                <td className="px-3 py-2.5">{reply.fromEmail}</td>
                <td className="px-3 py-2.5 font-medium">
                  <Link
                    href={`/inbox/${reply.id}`}
                    aria-label={`Open reply from ${reply.businessName ?? reply.fromEmail}`}
                    className="hover:underline"
                  >
                    {reply.subject || "(No subject)"}
                  </Link>
                </td>
                <td className="px-3 py-2.5">
                  {reply.businessName ?? "Unknown sender"}
                </td>
                <td className="px-3 py-2.5">
                  <StatusPill status={reply.stage ?? "NEW"} />
                </td>
                <td className="px-3 py-2.5">
                  {label("outcome", reply.outcome)}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  {formatWorkspaceDate(reply.receivedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
