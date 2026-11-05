import { and, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  importBatches,
  importRows as importRowTable,
  jobs,
} from "@/lib/db/schema";
import type { Ctx } from "./common";
import { audit, fail } from "./common";
import { importRows, type ImportOptions } from "./import";
import { listProspects, type ProspectFilters } from "./prospects";
import { LABELS, label } from "@/lib/taxonomy/enums";
import { toCsv } from "@/lib/utils";

export async function createImportBatch(
  ctx: Ctx,
  input: { fileName?: string; mapping: Record<string, string>; rows: Record<string, string>[] },
) {
  if (input.rows.length > 20_000) {
    throw fail("TOO_LARGE", "CSV exceeds 20,000 rows. Split the file and import in parts.", 422);
  }
  const [batch] = await db
    .insert(importBatches)
    .values({
      workspaceId: ctx.user.workspaceId,
      kind: "CSV",
      fileName: input.fileName?.slice(0, 255),
      mapping: input.mapping,
      status: "RUNNING",
      rowsTotal: input.rows.length,
      createdBy: ctx.user.userId,
    })
    .returning();

  if (input.rows.length) {
    await db.insert(importRowTable).values(
      input.rows.map((rawData, index) => ({
        workspaceId: ctx.user.workspaceId,
        batchId: batch.id,
        rowNumber: index + 1,
        rawData,
      })),
    );
  }

  await audit(ctx, "import.create", "import_batch", batch.id, { rows: input.rows.length });
  return batch;
}

export async function processBatchImport(payload: { batchId: string }) {
  const [batch] = await db.select().from(importBatches).where(eq(importBatches.id, payload.batchId));
  if (!batch || batch.status === "DONE") return;

  const ctx = {
    user: {
      userId: batch.createdBy ?? "",
      workspaceId: batch.workspaceId,
      email: "",
      name: "Import",
      role: "ADMIN" as const,
      workspaceName: "",
    },
  } as Ctx;

  const stored = await db
    .select({ rawData: importRowTable.rawData })
    .from(importRowTable)
    .where(eq(importRowTable.batchId, batch.id))
    .orderBy(importRowTable.rowNumber);
  const rows = stored.map((entry) => entry.rawData as Record<string, unknown>);
  const options: ImportOptions = {
    sourceLabel: `CSV · ${batch.fileName ?? "upload"}`,
  };

  const chunkSize = 500;
  let imported = batch.rowsImported;
  let invalid = batch.rowsInvalid;
  let duplicate = batch.rowsDuplicate;
  const errors = [...(batch.errorReport ?? [])];

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const result = await importRows(ctx, chunk, options);
    imported += result.imported;
    invalid += result.invalid;
    duplicate += result.duplicate;
    for (const s of result.skipped.slice(0, 50)) {
      errors.push({ row: i + 1, reason: s.reason });
    }
    await db
      .update(importBatches)
      .set({
        rowsProcessed: Math.min(i + chunkSize, rows.length),
        rowsImported: imported,
        rowsInvalid: invalid,
        rowsDuplicate: duplicate,
        errorReport: errors.slice(0, 500),
        updatedAt: new Date(),
      })
      .where(eq(importBatches.id, batch.id));
  }

  await db
    .update(importBatches)
    .set({
      status: "DONE",
      rowsProcessed: rows.length,
      rowsImported: imported,
      rowsInvalid: invalid,
      rowsDuplicate: duplicate,
      errorReport: errors.slice(0, 500),
      updatedAt: new Date(),
    })
    .where(eq(importBatches.id, batch.id));
}

export async function exportProspects(payload: { exportId: string }) {
  const [row] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, payload.exportId), eq(jobs.type, "EXPORT")));
  if (!row) return;

  const jobPayload = (row.payload ?? {}) as Record<string, unknown>;
  const filters = (jobPayload.filters ?? {}) as ProspectFilters;
  const all: Record<string, unknown>[] = [];
  let page = 1;
  // Bounded: 50k rows max per the plan.
  while (page <= 250) {
    const { rows } = await listProspects(
      { user: { userId: "", workspaceId: row.workspaceId, email: "", name: "Export", role: "ADMIN", workspaceName: "" } },
      { ...filters, page, pageSize: 200 },
    );
    for (const p of rows) {
      all.push({
        business_name: p.business_name,
        domain: p.domain_normalized ?? "",
        website: p.website ?? "",
        industry: label("industry", p.industry_slug),
        business_type: p.business_type_label ?? "",
        company_size: label("size", p.company_size),
        employees: p.employee_count ?? "",
        city: p.city ?? "",
        region: p.region ?? "",
        country: p.country_code ?? "",
        market: p.market ?? "",
        stage: label("stage", p.stage),
        fit: label("fit", p.fit),
        priority: label("priority", p.priority),
        contact_name: p.contact_name ?? "",
        role: label("role", p.contact_role),
        email: p.contact_email ?? "",
        contact_quality: label("quality", p.contact_quality),
        contactability: label("contactability", p.contactability),
        opportunities: (p.opportunities ?? []).map((o) => label("opportunity", o)).join(" | "),
        services: (p.services ?? []).map((s) => label("service", s)).join(" | "),
        tags: (p.tags ?? []).map((t) => t.label).join(" | "),
        next_action: p.next_action ?? "",
        follow_up_date: p.follow_up_date ?? "",
        last_contacted_at: p.last_contacted_at?.toISOString() ?? "",
      });
    }
    if (rows.length < 200) break;
    page++;
  }

  await db
    .update(jobs)
    .set({
      status: "DONE",
      updatedAt: new Date(),
      payload: { ...jobPayload, csv: toCsv(all), rowCount: all.length },
    })
    .where(eq(jobs.id, row.id));
  await audit(
    { user: { userId: "", workspaceId: row.workspaceId, email: "", name: "Export", role: "ADMIN", workspaceName: "" } },
    "prospect.export",
    "export",
    row.id,
    { rows: all.length },
  );
}

export const _unusedLabels = LABELS;
export const _countSql = sql;
