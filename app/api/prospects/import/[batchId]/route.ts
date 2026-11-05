import { and, eq } from "drizzle-orm";

import { route, type RouteContext } from "@/lib/api";
import { db } from "@/lib/db/client";
import { importBatches } from "@/lib/db/schema";
import { AppError } from "@/lib/services/common";

type P = { batchId: string };

export const GET = route<P>(async (_req, context: RouteContext<P>, ctx) => {
  const { batchId } = await context.params;
  const [row] = await db
    .select()
    .from(importBatches)
    .where(
      and(
        eq(importBatches.id, batchId),
        eq(importBatches.workspaceId, ctx.user.workspaceId),
      ),
    );
  if (!row) throw new AppError("NOT_FOUND", "Import not found", 404);
  return {
    id: row.id,
    status: row.status,
    fileName: row.fileName,
    rowsTotal: row.rowsTotal,
    processed: row.rowsProcessed,
    imported: row.rowsImported,
    invalid: row.rowsInvalid,
    duplicate: row.rowsDuplicate,
    errors: row.errorReport,
  };
});
