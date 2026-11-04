import { json, route } from "@/lib/api";
import { createImportBatch } from "@/lib/services/import-runner";
import { enqueue } from "@/lib/jobs/queue";

export const POST = route(async (req, _ctx, ctx) => {
  const body = await json<{
    fileName?: string;
    mapping?: Record<string, string>;
    rows?: Record<string, string>[];
  }>(req);

  if (!body.rows?.length) throw new Error("No rows to import");

  const batch = await createImportBatch(ctx, {
    fileName: body.fileName,
    mapping: body.mapping ?? {},
    rows: body.rows,
  });

  await enqueue(ctx.user.workspaceId, "IMPORT_BATCH", { batchId: batch.id }, {
    dedupeKey: `import:${batch.id}`,
  });

  return { batchId: batch.id, rowsTotal: batch.rowsTotal };
});
