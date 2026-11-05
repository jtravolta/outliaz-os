import { and, eq } from "drizzle-orm";

import { route, type RouteContext } from "@/lib/api";
import { db } from "@/lib/db/client";
import { jobs } from "@/lib/db/schema";
import { AppError } from "@/lib/services/common";

type P = { jobId: string };

export const GET = route<P>(async (req, context: RouteContext<P>, ctx) => {
  const { jobId } = await context.params;
  const [row] = await db
    .select()
    .from(jobs)
    .where(
      and(
        eq(jobs.id, jobId),
        eq(jobs.workspaceId, ctx.user.workspaceId),
        eq(jobs.type, "EXPORT"),
      ),
    );
  if (!row) throw new AppError("NOT_FOUND", "Export not found", 404);

  const payload = (row.payload ?? {}) as Record<string, unknown>;
  const csv = typeof payload.csv === "string" ? payload.csv : null;
  const rowCount = typeof payload.rowCount === "number" ? payload.rowCount : 0;

  if (req.nextUrl.searchParams.get("download") === "1") {
    if (row.status !== "DONE" || !csv)
      throw new AppError("NOT_READY", "Export is still running", 409);
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="outbound-prospects-${row.id.slice(0, 8)}.csv"`,
      },
    });
  }

  return {
    id: row.id,
    status: row.status,
    rowCount,
    downloadUrl: `/api/prospects/export/${row.id}?download=1`,
  };
});
