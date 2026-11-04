"use client";

import { useState, type ReactNode } from "react";
import { Button, Select } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

const CANONICAL_FIELDS = [
  "business_name", "website", "email", "contact_name", "contact_first_name", "contact_last_name",
  "phone", "city", "region", "country", "industry", "business_type", "employees",
  "opportunities", "services", "role", "tags", "market", "next_action", "follow_up_date",
];

export function ImportWizard({ onDone }: { onDone?: () => void }) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [fileName, setFileName] = useState("");
  const [csv, setCsv] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[]>([]);
  const [invalid, setInvalid] = useState(0);
  const [busy, setBusy] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);

  const parse = async () => {
    setBusy(true);
    const res = await fetch("/api/prospects/import/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ csv, fileName }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast("error", { description: data?.error?.message ?? "Could not parse file" });
      setBusy(false);
      return;
    }
    setHeaders(data.headers ?? []);
    setMapping(data.mapping ?? {});
    setPreviewRows((data.previewRows ?? []).filter((r: Record<string, unknown>) => r.ok).map((r: Record<string, unknown>) => r.row));
    setInvalid(data.invalid ?? 0);
    setStep(2);
    setBusy(false);
  };

  const run = async () => {
    setBusy(true);
    const res = await fetch("/api/prospects/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fileName, mapping, rows: previewRows }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      toast("error", { description: data?.error?.message ?? "Import failed" });
      return;
    }
    setBatchId(data.batchId);
    setStep(4);
    toast("success", { description: `Import batch queued (${data.rowsTotal ?? previewRows.length} rows)` });
  };

  const steps = ["Upload", "Map columns", "Preview", "Run"];

  return (
    <div className="flex flex-col gap-5">
      <ol className="flex items-center gap-2">
        {steps.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-2">
            <span
              className={`flex size-6 items-center justify-center rounded-full text-[11px] font-bold ${i + 1 === step ? "bg-primary text-primary-foreground" : i + 1 < step ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}
            >
              {i + 1 < step ? "✓" : i + 1}
            </span>
            <span className="text-[12.5px] font-medium">{s}</span>
          </li>
        ))}
      </ol>

      {step === 1 && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <Field label="File name">
            <input className="field" value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="prospects-oct.csv" />
          </Field>
          <Field label="CSV contents (first 200 rows will be previewed)">
            <textarea className="field min-h-64 font-mono text-xs" value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={"business_name,website,email,city,country\nAcme Dental,https://acmedental.co.uk,hello@acmedental.co.uk,London,GB"} />
          </Field>
          <Button onClick={() => void parse()} disabled={!csv.trim() || busy}>
            {busy ? "Parsing…" : "Parse preview"}
          </Button>
        </div>
      )}

      {step === 2 && headers.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
          <p className="text-[12.5px] text-muted-foreground">Map detected columns to taxonomy fields. Auto-guessed based on headers.</p>
          {headers.map((h) => (
            <div key={h} className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-medium">{h}</span>
              <Select value={mapping[h] ?? ""} onValueChange={(v: string) => setMapping((m) => ({ ...m, [h]: v }))}>
                <option value="">— ignore —</option>
                {CANONICAL_FIELDS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </Select>
            </div>
          ))}
          <div className="mt-2 flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={() => setStep(3)}>Continue to preview</Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <p className="text-[12.5px] text-muted-foreground">
            {previewRows.length} rows ready · {invalid} invalid in first 200 rows
          </p>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-left text-[12px]">
              <thead className="bg-muted/40">
                <tr>
                  {CANONICAL_FIELDS.slice(0, 8).map((f) => (
                    <th key={f} className="px-2 py-1.5 font-semibold">{f}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.slice(0, 25).map((row, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-2 py-1.5">{String(row.business_name ?? "")}</td>
                    <td className="px-2 py-1.5">{String(row.email ?? "")}</td>
                    <td className="px-2 py-1.5">{String(row.city ?? "")}</td>
                    <td className="px-2 py-1.5">{String(row.industry ?? "")}</td>
                    <td className="px-2 py-1.5">{String(row.opportunities ?? "")}</td>
                    <td className="px-2 py-1.5">{String(row.services ?? "")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
            <Button onClick={() => setStep(4)}>Continue to run</Button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <p className="text-[13px]">
            {batchId ? `Batch ${batchId.slice(0, 8)}… is queued for background import.` : "Ready to run the preview rows through the import pipeline."}
          </p>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(3)}>Back</Button>
            <Button onClick={() => void run()} disabled={busy || !previewRows.length}>
              {busy ? "Working…" : "Run import"}
            </Button>
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => (step > 1 ? setStep((s) => s - 1) : undefined)} disabled={step === 1}>Back</Button>
        {step < 4 && (
          <Button onClick={() => setStep((s) => Math.min(4, s + 1))} disabled={step === 1 && !csv.trim()}>
            Next
          </Button>
        )}
        {step === 4 && batchId && (
          <Button onClick={() => onDone?.()}>Done</Button>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
