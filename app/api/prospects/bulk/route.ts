import { json, route } from "@/lib/api";
import { bulkAction } from "@/lib/services/prospects";
import { enroll } from "@/lib/services/sequences";

export const POST = route(async (req, _ctx, ctx) => {
  const body = await json<{
    ids?: string[];
    action?: string;
    value?: string;
    reason?: string;
    sequenceId?: string;
  }>(req);

  const ids = body.ids ?? [];
  if (!ids.length) return { results: [], succeeded: 0, failed: 0 };

  if (body.action === "enroll") {
    if (!body.sequenceId) throw new Error("Choose a sequence to enroll into");
    const result = await enroll(ctx, body.sequenceId, ids);
    return {
      enrolled: result.enrolled,
      skipped: result.skipped,
      summary: result.summary,
      results: result.rows.map((r) => ({ id: r.id, ok: r.eligible, error: r.reasons.join(", ") })),
      succeeded: result.enrolled,
      failed: result.skipped,
    };
  }

  return bulkAction(
    ctx,
    ids,
    (body.action ?? "") as never,
    body.value,
    body.reason,
  );
});
