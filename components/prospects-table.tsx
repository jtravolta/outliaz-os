"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Download, Search } from "lucide-react";
import { ProspectDrawer } from "@/components/prospect-drawer";
import { Button } from "@/components/ui/button";
import { label } from "@/lib/taxonomy/enums";
import type { ProspectWithRelations } from "@/lib/services/prospects";

export type ProspectRow = ProspectWithRelations;

type BadgeTone = "neutral" | "info" | "good" | "warn" | "bad";

const STAGES = [
  "NEW",
  "RESEARCHED",
  "QUALIFIED",
  "CONTACTED",
  "FOLLOW_UP",
  "REPLIED",
  "MEETING",
  "PROPOSAL",
  "WON",
  "LOST",
  "DISQUALIFIED",
];

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
  const [filters, setFilters] =
    useState<Record<string, string>>(initialFilters);

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
    setDrawerId(searchParams.get("prospect"));
  }, [searchParams]);

  const load = useCallback(async (f: Record<string, string>) => {
    setLoading(true);
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) if (v) params.set(k, v);
    const res = await fetch(
      `/api/prospects${params.toString() ? `?${params.toString()}` : ""}`,
      { cache: "no-store" },
    );
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
    if (key !== "page") next.page = "";
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
      setBulkMessage(
        `${data.succeeded ?? 0} succeeded, ${data.failed ?? 0} failed`,
      );
      void load(filters);
    } else {
      setBulkMessage(data?.error?.message ?? "Bulk action failed");
    }
    return data;
  };

  const bulk = async (action: string, value?: string) => {
    if (action === "enroll") {
      const active = (sequences as { id: string; status: string }[]).find(
        (s) => s.status === "ACTIVE",
      );
      if (!active) {
        setBulkMessage("Activate a sequence first");
        return;
      }
      const data = await runBulk("enroll", active.id);
      setBulkMessage(
        data?.enrolled
          ? `Enrolled ${data.enrolled} prospects`
          : "Nothing eligible to enroll",
      );
      return;
    }
    const data = await runBulk(action, value);
    if (data?.succeeded) setBulkMessage(`Updated ${data.succeeded}`);
  };

  const exportCsv = async () => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
    const res = await fetch(
      `/api/prospects/export${params.toString() ? `?${params.toString()}` : ""}`,
      { method: "POST" },
    );
    const data = await res.json();
    if (res.ok)
      window.location.href = `/api/prospects/export/${data.jobId}?download=1`;
  };

  useEffect(() => {
    fetch("/api/sequences")
      .then((r) => r.json())
      .then((d) => setSequences(d ?? []))
      .catch(() => setSequences([]));
  }, []);

  const activeFilters = useMemo(
    () => Object.entries(filters).filter(([, v]) => v),
    [filters],
  );
  const pageSize = Number(filters.pageSize ?? 50);
  const page = Math.max(1, Number(filters.page ?? 1));
  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(total, page * pageSize);
  const hasPrev = page > 1;
  const hasNext = showingTo < total;

  return (
    <div className="prospects-view">
      <form
        className="prospect-toolbar"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          void load(filters);
        }}
      >
        <div className="prospect-search">
          <Search aria-hidden="true" />
          <input
            className="field"
            type="search"
            aria-label="Search prospects"
            placeholder="Search business, domain, contact or email"
            defaultValue={filters.q ?? ""}
            onChange={(e) => setFilter("q", e.target.value)}
          />
        </div>
        <select
          className="field prospect-filter"
          aria-label="Filter by stage"
          value={filters.stage ?? ""}
          onChange={(e) => setFilter("stage", e.target.value)}
        >
          <option value="">All stages</option>
          {STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {label("stage", stage)}
            </option>
          ))}
        </select>
        <Button
          variant="outline"
          type="submit"
          disabled={loading}
          aria-busy={loading}
        >
          Refresh
        </Button>
        <p className="prospect-count" aria-live="polite">
          {total === 0
            ? "No prospects"
            : `Showing ${showingFrom}–${showingTo} of ${total}`}
        </p>
      </form>

      {activeFilters.length > 0 && (
        <div className="filter-strip">
          <span className="filter-strip-label">Active filters</span>
          {activeFilters.map(([key, value]) => (
            <span key={key} className="filter-chip">
              {key === "stage" ? "Stage" : key}:{" "}
              <strong>{key === "stage" ? label("stage", value) : value}</strong>
              <button
                type="button"
                onClick={() => setFilter(key, "")}
                aria-label={`Clear ${key} filter`}
              >
                ×
              </button>
            </span>
          ))}
          <button type="button" onClick={clearAll} className="text-action">
            Clear all
          </button>
        </div>
      )}

      <div className="panel table-panel">
        <table className="data-table prospect-table">
          <caption className="sr-only">
            Prospects in this workspace. Select a row to review the business.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="cell-select">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={toggleAll}
                  aria-label="Select all prospects on this page"
                />
              </th>
              <th scope="col">Business</th>
              <th scope="col" className="col-secondary">
                Industry
              </th>
              <th scope="col">Location</th>
              <th scope="col" className="col-secondary">
                Size
              </th>
              <th scope="col">Stage</th>
              <th scope="col">Fit · Priority</th>
              <th scope="col">Contact</th>
              <th scope="col">Next action</th>
              <th scope="col" className="cell-open">
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="cell-select">
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={() => toggleSelect(r.id)}
                    aria-label={`Select ${r.business_name}`}
                  />
                </td>
                <td data-label="Business">
                  <Link
                    data-prospect-name
                    href={`/prospects?prospect=${r.id}`}
                    className="row-title text-left"
                    onClick={() => setDrawerId(r.id)}
                  >
                    {r.business_name}
                  </Link>
                  <span className="row-meta">
                    {r.domain_normalized ?? "No domain"}
                  </span>
                </td>
                <td data-label="Industry" className="col-secondary">
                  <span>{label("industry", r.industry_slug)}</span>
                  <span className="row-meta">
                    {r.business_type_label ?? "Type not set"}
                  </span>
                </td>
                <td data-label="Location">
                  <span>{r.city ?? "City not set"}</span>
                  <span className="row-meta">{r.country_code ?? "—"}</span>
                </td>
                <td data-label="Size" className="col-secondary">
                  {label("size", r.company_size)}
                </td>
                <td data-label="Stage">
                  <StageBadge stage={r.stage} />
                </td>
                <td data-label="Fit · Priority">
                  <span className="badge-row">
                    <FitBadge fit={r.fit} />
                    <PriorityBadge priority={r.priority} />
                  </span>
                </td>
                <td data-label="Contact">
                  <span>{r.contact_name ?? "Not set"}</span>
                  <span className="row-meta">
                    {r.contact_email ?? "No email"}
                  </span>
                </td>
                <td data-label="Next action">
                  <span>{r.next_action ?? "No next action"}</span>
                  <span className="row-meta">{r.follow_up_date ?? ""}</span>
                </td>
                <td className="cell-open">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDrawerId(r.id)}
                    aria-label={`Open ${r.business_name}`}
                  >
                    Open
                  </Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="empty-cell">
                  <strong>
                    {loading ? "Loading prospects…" : "No matching prospects"}
                  </strong>
                  <span>
                    {loading
                      ? "Fetching the latest records."
                      : "Adjust your search or clear the filters."}
                  </span>
                  {!loading && activeFilters.length > 0 && (
                    <Button variant="outline" size="sm" onClick={clearAll}>
                      Clear filters
                    </Button>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {(hasPrev || hasNext) && (
          <div className="pagination">
            <span className="row-meta">
              Page {page} of {Math.max(1, Math.ceil(total / pageSize))}
            </span>
            <div className="pagination-actions">
              <Button
                variant="outline"
                size="sm"
                disabled={!hasPrev}
                onClick={() => setFilter("page", String(page - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasNext}
                onClick={() => setFilter("page", String(page + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {selected.size > 0 && (
        <div className="bulk-bar">
          <span className="bulk-count">{selected.size} selected</span>
          <BulkButton label="Enroll" onClick={() => void bulk("enroll")} />
          <BulkButton label="Stage" onClick={() => void bulk("stage")} />
          <BulkButton label="Priority" onClick={() => void bulk("priority")} />
          <BulkButton label="Fit" onClick={() => void bulk("fit")} />
          <BulkButton label="Tag" onClick={() => void bulk("tag")} />
          <BulkButton label="Suppress" onClick={() => void bulk("suppress")} />
          <BulkButton
            label="Delete"
            onClick={() => void bulk("delete")}
            danger
          />
          <button
            type="button"
            onClick={() => void exportCsv()}
            className="bulk-export"
          >
            <Download aria-hidden="true" /> Export
          </button>
          {bulkMessage && <span className="row-meta">{bulkMessage}</span>}
        </div>
      )}

      {drawerId && (
        <ProspectDrawer
          id={drawerId}
          onClose={() => {
            setDrawerId(null);
            const next = { ...filters, prospect: "" };
            setFilters(next);
            updateParams(next);
          }}
        />
      )}
    </div>
  );
}

function BulkButton({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bulk-button"
      data-danger={danger || undefined}
    >
      {label}
    </button>
  );
}

export function StageBadge({ stage }: { stage?: string | null }) {
  const toneMap: Record<string, BadgeTone> = {
    NEW: "neutral",
    RESEARCHED: "info",
    QUALIFIED: "good",
    CONTACTED: "info",
    FOLLOW_UP: "warn",
    REPLIED: "good",
    MEETING: "good",
    PROPOSAL: "warn",
    WON: "good",
    LOST: "neutral",
    DISQUALIFIED: "bad",
  };
  return (
    <Badge tone={toneMap[stage ?? ""] ?? "neutral"}>
      {label("stage", stage)}
    </Badge>
  );
}

export function FitBadge({ fit }: { fit?: string | null }) {
  const toneMap: Record<string, BadgeTone> = {
    STRONG: "good",
    GOOD: "info",
    POSSIBLE: "warn",
    POOR: "bad",
  };
  return (
    <Badge tone={toneMap[fit ?? ""] ?? "neutral"}>{label("fit", fit)}</Badge>
  );
}

export function PriorityBadge({ priority }: { priority?: string | null }) {
  const toneMap: Record<string, BadgeTone> = {
    HIGH: "bad",
    MEDIUM: "warn",
    LOW: "neutral",
    DISQUALIFIED: "bad",
  };
  return (
    <Badge tone={toneMap[priority ?? ""] ?? "neutral"}>
      {label("priority", priority)}
    </Badge>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: BadgeTone;
  children: React.ReactNode;
}) {
  return (
    <span className="badge" data-tone={tone}>
      {children}
    </span>
  );
}
