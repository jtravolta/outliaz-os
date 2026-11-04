"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Plus, Search, SlidersHorizontal, Upload } from "lucide-react";
import { ProspectDrawer } from "@/components/prospect-drawer";
import type { ProspectWithRelations } from "@/lib/services/prospects";

export type ProspectRow = ProspectWithRelations;

export function ProspectsTable({
  initialRows,
  initialTotal,
  initialFilters,
}: {
  initialRows: ProspectRow[];
  initialTotal: number;
  initialFilters: Record<string, string>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState(initialRows);
  const [total, setTotal] = useState(initialTotal);
  const [filters, setFilters] = useState<Record<string, string>>(initialFilters);

  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [sequences, setSequences] = useState<Record<string, unknown>[]>([]);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);

  const updateParams = useCallback(
    (next: Record<string, string>) => {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(next)) if (v) params.set(k, v);
      router.replace(`/prospects?${params.toString()}`);
    },
    [router],
  );

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const [k, v] of searchParams.entries()) next[k] = v;
    setFilters(next);
  }, [searchParams]);

  const load = useCallback(async (f: Record<string, string>) => {
    setLoading(true);
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) if (v) params.set(k, v);
    const res = await fetch(`/api/prospects${params.toString() ? `?${params.toString()}` : ""}`, { cache: "no-store" });
    const data = await res.json();
    if (res.ok) {
      setRows(data.rows ?? []);
      setTotal(data.total ?? 0);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const setFilter = (key: string, value: string) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    updateParams(next);
    void load(next);
  };

  const clearAll = () => {
    setFilters({});
    updateParams({});
    void load({});
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) rows.forEach((r) => next.delete(r.id));
      else rows.forEach((r) => next.add(r.id));
      return next;
    });
  };

  const runBulk = async (action: string, value?: string) => {
    if (selected.size === 0) return;
    const res = await fetch("/api/prospects/bulk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: [...selected], action, value }),
    });
    const data = await res.json();
    if (res.ok) {
      setSelected(new Set());
      setBulkMessage(`${data.succeeded ?? 0} succeeded, ${data.failed ?? 0} failed`);
      void load(filters);
    } else {
      setBulkMessage(data?.error?.message ?? "Bulk action failed");
    }
    return data;
  };

  const bulk = async (action: string, value?: string) => {
    if (action === "enroll") {
      const active = (sequences as { id: string; status: string }[]).find((s) => s.status === "ACTIVE");
      if (!active) {
        setBulkMessage("Activate a sequence first");
        return;
      }
      const data = await runBulk("enroll", active.id);
      setBulkMessage(data?.enrolled ? `Enrolled ${data.enrolled} prospects` : "Nothing eligible to enroll");
      return;
    }
    const data = await runBulk(action, value);
    if (data?.succeeded) setBulkMessage(`Updated ${data.succeeded}`);
  };

  const exportCsv = async () => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
    const res = await fetch(`/api/prospects/export${params.toString() ? `?${params.toString()}` : ""}`, { method: "POST" });
    const data = await res.json();
    if (res.ok) window.location.href = `/api/prospects/export/${data.jobId}?download=1`;
  };

  useEffect(() => {
    fetch("/api/sequences")
      .then((r) => r.json())
      .then((d) => setSequences(d ?? []))
      .catch(() => setSequences([]));
  }, []);

  const filtersActive = useMemo(() => Object.entries(filters).filter(([, v]) => v).length > 0, [filters]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-60 flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="field h-9 pl-9"
            placeholder="Search business, domain, contact, email…"
            defaultValue={filters.q ?? ""}
            onChange={(e) => setFilter("q", e.target.value)}
          />
        </div>
        <select className="field h-9 w-[150px]" value={filters.stage ?? ""} onChange={(e) => setFilter("stage", e.target.value)}>
          <option value="">All stages</option>
          {["NEW", "RESEARCHED", "QUALIFIED", "CONTACTED", "FOLLOW_UP", "REPLIED", "MEETING", "PROPOSAL", "WON", "LOST", "DISQUALIFIED"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 h-9 text-[13px] font-medium hover:bg-muted">
          <SlidersHorizontal className="size-3.5" /> Filters
        </button>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => void load(filters)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 h-9 text-[13px] font-medium hover:bg-muted">
            Refresh
          </button>
          <button onClick={() => router.push("/prospects/import")} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 h-9 text-[13px] font-medium hover:bg-muted">
            <Upload className="size-3.5" /> Import
          </button>
          <button onClick={() => router.push("/prospects/new")} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 h-9 text-[13px] font-medium text-primary-foreground hover:brightness-110">
            <Plus className="size-3.5" /> New prospect
          </button>
        </div>
      </div>

      {filtersActive && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
          <span className="text-[12px] font-semibold text-muted-foreground uppercase">Active filters</span>
          {Object.entries(filters).filter(([, v]) => v).map(([k, v]) => (
            <span key={k} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[12px]">
              {k}: <strong>{v}</strong>
              <button onClick={() => setFilter(k, "")} className="text-muted-foreground hover:text-foreground" aria-label={`Clear ${k}`}>×</button>
            </span>
          ))}
          <button onClick={clearAll} className="text-[12px] font-medium text-primary hover:underline">Clear all</button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="w-10 px-3 py-2.5">
                <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Select all" className="accent-violet-600" />
              </th>
              <th className="px-3 py-2.5">Business</th>
              <th className="px-3 py-2.5">Industry / Type</th>
              <th className="px-3 py-2.5">Location</th>
              <th className="px-3 py-2.5">Size</th>
              <th className="px-3 py-2.5">Stage</th>
              <th className="px-3 py-2.5">Fit / Priority</th>
              <th className="px-3 py-2.5">Contact</th>
              <th className="px-3 py-2.5">Next action</th>
              <th className="w-12" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                <td className="px-3 py-2.5">
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} aria-label={`Select ${r.business_name}`} className="accent-violet-600" />
                </td>
                <td className="px-3 py-2.5">
                  <Link href={`/prospects/${r.id}`} className="font-semibold hover:underline">{r.business_name}</Link>
                  <p className="text-[11.5px] text-muted-foreground">{r.domain_normalized}</p>
                </td>
                <td className="px-3 py-2.5">
                  <p>{r.industry_slug?.replace(/_/g, " ")}</p>
                  <p className="text-[11.5px] text-muted-foreground">{r.business_type_label}</p>
                </td>
                <td className="px-3 py-2.5">
                  {r.city && <p>{r.city}</p>}
                  <p className="text-[11.5px] text-muted-foreground">{r.country_code}</p>
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">{r.company_size?.replace(/_/g, " ")}</td>
                <td className="px-3 py-2.5"><StageBadge stage={r.stage} /></td>
                <td className="px-3 py-2.5">
                  <FitBadge fit={r.fit} /> <PriorityBadge priority={r.priority} />
                </td>
                <td className="px-3 py-2.5">
                  <p>{r.contact_name}</p>
                  <p className="text-[11.5px] text-muted-foreground">{r.contact_email}</p>
                </td>
                <td className="px-3 py-2.5">
                  {r.next_action && <p className="max-w-40 truncate">{r.next_action}</p>}
                  <p className="text-[11.5px] text-muted-foreground">{r.follow_up_date ?? ""}</p>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <button onClick={() => setDrawerId(r.id)} className="text-[12px] font-medium text-primary hover:underline">Open</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-10 text-center text-[13px] text-muted-foreground">
                  {loading ? "Loading prospects…" : "No prospects match these filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected.size > 0 && (
        <div className="sticky bottom-4 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 shadow-lg">
          <span className="text-[13px] font-semibold">{selected.size} selected</span>
          <BulkButton label="Enroll" onClick={() => void bulk("enroll")} />
          <BulkButton label="Stage" onClick={() => void bulk("stage")} />
          <BulkButton label="Priority" onClick={() => void bulk("priority")} />
          <BulkButton label="Fit" onClick={() => void bulk("fit")} />
          <BulkButton label="Tag" onClick={() => void bulk("tag")} />
          <BulkButton label="Suppress" onClick={() => void bulk("suppress")} />
          <BulkButton label="Delete" onClick={() => void bulk("delete")} danger />
          <button onClick={() => void exportCsv} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border px-3 h-8 text-[12.5px] font-medium hover:bg-muted">
            <Download className="size-3.5" /> Export
          </button>
          {bulkMessage && <span className="text-[12px] text-muted-foreground">{bulkMessage}</span>}
        </div>
      )}

      {drawerId && <ProspectDrawer id={drawerId} onClose={() => setDrawerId(null)} />}
    </div>
  );
}

function BulkButton({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border px-2.5 h-8 text-[12.5px] font-medium ${danger ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100" : "border-border hover:bg-muted"}`}
    >
      {label}
    </button>
  );
}

export function StageBadge({ stage }: { stage?: string | null }) {
  const toneMap: Record<string, string> = {
    NEW: "neutral", RESEARCHED: "blue", QUALIFIED: "indigo", CONTACTED: "cyan", FOLLOW_UP: "amber",
    REPLIED: "violet", MEETING: "teal", PROPOSAL: "purple", WON: "green", LOST: "neutral", DISQUALIFIED: "red",
  };
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${toneMap[stage ?? ""] ?? "neutral"}`}>{stage?.replace(/_/g, " ") ?? ""}</span>;
}

export function FitBadge({ fit }: { fit?: string | null }) {
  const tone = fit === "STRONG" ? "green" : fit === "GOOD" ? "teal" : fit === "POSSIBLE" ? "amber" : fit === "POOR" ? "red" : "neutral";
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone}`}>{fit}</span>;
}

export function PriorityBadge({ priority }: { priority?: string | null }) {
  const tone = priority === "HIGH" ? "red" : priority === "MEDIUM" ? "amber" : priority === "LOW" ? "neutral" : "red";
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone}`}>{priority}</span>;
}
