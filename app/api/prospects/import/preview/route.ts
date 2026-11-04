import { json, route } from "@/lib/api";
import { applyMapping, guessMapping, normalizeRow } from "@/lib/services/import";
import { parseCsv } from "@/lib/utils";

export const POST = route(async (req) => {
  const body = await json<{ csv?: string; headers?: string[]; rows?: string[][]; mapping?: Record<string, string> }>(req);

  let grid: string[][] = [];
  if (body.csv) grid = parseCsv(body.csv);
  else if (body.headers) grid = [body.headers, ...(body.rows ?? [])];

  if (!grid.length) throw new Error("Could not read any rows from that file");

  const headers = grid[0].map((h) => h.trim());
  const mapping = body.mapping ?? guessMapping(headers);
  const rows = applyMapping([headers, ...grid.slice(1, 201)], mapping);

  const preview = rows.map((row, index) => {
    const normalized = normalizeRow(row);
    if ("error" in normalized) return { index: index + 1, ok: false, reason: normalized.error, row };
    return {
      index: index + 1,
      ok: true,
      reason: null,
      row,
      business_name: normalized.data.business_name,
      email: normalized.data.contact_email ?? null,
      industry: normalized.data.industry ?? null,
      city: normalized.data.city ?? null,
    };
  });

  const fields = [
    "business_name", "website", "email", "contact_name", "contact_first_name", "contact_last_name",
    "phone", "city", "region", "country", "industry", "business_type", "employees",
    "opportunities", "services", "role", "tags", "market", "next_action", "follow_up_date",
  ];

  return {
    headers,
    mapping,
    fields,
    totalRows: grid.length - 1,
    previewRows: preview,
    valid: preview.filter((p) => p.ok).length,
    invalid: preview.filter((p) => !p.ok).length,
    truncated: grid.length - 1 > 200,
  };
});
