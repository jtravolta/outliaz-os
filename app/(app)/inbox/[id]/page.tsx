import { PageHeader } from "@/components/page-header";
import { getSession } from "@/lib/auth/session";
import { getReply } from "@/lib/services/replies";
import { formatWorkspaceDate } from "@/lib/format";
import Link from "next/link";
import { notFound } from "next/navigation";
import { label } from "@/lib/taxonomy/enums";

export const metadata = { title: "Reply" };

export default async function InboxDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSession();
  if (!user) return null;
  const { id } = await params;
  const data = await getReply({ user }, id).catch(() => null);
  if (!data) notFound();
  const { reply, prospect } = data;
  return (
    <div className="mx-auto flex max-w-4xl min-w-0 flex-col gap-5">
      <PageHeader
        title={reply.subject || "Reply"}
        description={`From ${prospect?.businessName ?? reply.fromEmail}`}
        actions={
          <Link href="/inbox" className="text-sm font-medium hover:underline">
            Back to inbox
          </Link>
        }
      />
      <dl className="reply-meta">
        <div>
          <dt>Received</dt>
          <dd>{formatWorkspaceDate(reply.receivedAt)}</dd>
        </div>
        <div>
          <dt>From</dt>
          <dd>{reply.fromEmail}</dd>
        </div>
        <div>
          <dt>Outcome</dt>
          <dd>
            {reply.outcome ? label("outcome", reply.outcome) : "Not classified"}
          </dd>
        </div>
      </dl>
      <article className="reply-body">
        {reply.bodyText || reply.snippet || "No message body available."}
      </article>
    </div>
  );
}
