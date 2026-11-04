import { and, eq } from "drizzle-orm";

import { route, type RouteContext } from "@/lib/api";
import { db } from "@/lib/db/client";
import { exportJobs } from "@/lib/db/schema";
import { AppError } from "@/lib/services/common";

type P = { jobId: string };

export const GET = route<P>(async (req, context: RouteContext<P>, ctx) => {
  const { jobId } = await context.params;
  const [row] = await db
    .select()
    .from(exportJobs)
    .where(and(eq(exportJobs.id, jobId), eq(exportJobs.workspaceId, ctx.user.workspaceId)));
  if (!row) throw new AppError("NOT_FOUND", "Export not found", 404);

  if (req.nextUrl.searchParams.get("download") === "1") {
    if (row.status !== "DONE" || !row.csv) throw new AppError("NOT_READY", "Export is still running", 409);
    return new Response(row.csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="outbound-prospects-${row.id.slice(0, 8)}.csv"`,
      },
    });
  }

  return {
    id: row.id,
    status: row.status,
    rowCount: row.rowCount,
    downloadUrl: `/api/prospects/export/${row.id}?download=1`,
  };
});
