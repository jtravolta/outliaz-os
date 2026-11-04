"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Button,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui/primitives";
import { Drawer } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import {
  allowedTransitions,
  missing,
  qualificationMissing,
  researchMissing,
} from "@/lib/taxonomy/gates";
import { label } from "@/lib/taxonomy/enums";
import type { ProspectWithRelations } from "@/lib/services/prospects";
import { formatWorkspaceDate } from "@/lib/format";

const TABS = ["Overview", "Research", "Timeline", "Emails", "Notes"] as const;

type Detail = {
  prospect: ProspectWithRelations;
  notes: { id: string; bodyMd: string; createdAt: string }[];
  events: {
    id: string;
    type: string;
    payload: Record<string, unknown>;
    createdAt: string;
  }[];
  messages: {
    id: string;
    subject: string;
    status: string;
    sentAt: string | null;
    bodyMd: string;
    openCount: number;
  }[];
  ownerName?: string | null;
  allowedTransitions: string[];
};

export function ProspectDrawer({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    let on = true;
    setLoading(true);
    void fetch(`/api/prospects/${id}`, { cache: "no-store" })
      .then(async (r) => ({ ok: r.ok, data: await r.json() }))
      .then(({ ok, data }) => {
        if (!on) return;
        if (!ok)
          throw new Error(data?.error?.message ?? "Failed to load prospect");
        setDetail(data as Detail);
      })
      .catch((e) => toast("error", { description: (e as Error).message }))
      .finally(() => {
        if (on) setLoading(false);
      });
    return () => {
      on = false;
    };
  }, [id]);

  return (
    <Drawer open onClose={onClose}>
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3.5">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight">
              {detail?.prospect?.business_name}
            </h2>
            <p className="text-[12px] text-muted-foreground">
              {detail?.prospect?.domain_normalized}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted"
          >
            ✕
          </button>
        </div>

        <div className="border-b border-border px-5">
          <div className="flex gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`whitespace-nowrap border-b-2 px-2.5 py-2 text-[13px] font-medium transition-colors ${
                  tab === t
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading || !detail ? (
            <p className="text-[13px] text-muted-foreground">Loading…</p>
          ) : tab === "Overview" ? (
            <OverviewTab detail={detail} />
          ) : tab === "Research" ? (
            <ResearchTab detail={detail} />
          ) : tab === "Timeline" ? (
            <TimelineTab detail={detail} />
          ) : tab === "Emails" ? (
            <EmailsTab detail={detail} />
          ) : (
            <NotesTab detail={detail} />
          )}
        </div>
      </div>
    </Drawer>
  );
}

function OverviewTab({ detail }: { detail: Detail }) {
  const p = detail.prospect;
  const { toast } = useToast();
  const router = useRouter();
  const [stage, setStage] = useState(p.stage);
  const [reason, setReason] = useState("");

  const transition = async (to: string) => {
    const res = await fetch(`/api/prospects/${p.id}/stage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ to, reason }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast("error", {
        description: data?.error?.message ?? "Transition failed",
      });
      return;
    }
    toast("success", { description: `Moved to ${to}` });
    onCloseAndRefresh();
  };

  const onCloseAndRefresh = () => {
    // Drawer stays mounted in the parent; parent reloads via router refresh.
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      {p.is_duplicate_candidate && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
          Possible duplicate candidate.{" "}
          <Link
            href={`/prospects/${p.id}?tab=merge`}
            className="font-semibold underline"
          >
            Review merge
          </Link>
        </div>
      )}

      <section className="rounded-xl border border-border">
        <SectionHead>Identity</SectionHead>
        <KV k="Stage" v={p.stage} />
        <KV k="Fit" v={p.fit} />
        <KV k="Priority" v={p.priority} />
        <KV k="Owner" v={detail.ownerName ?? null} />
        <KV k="Source" v={p.source_label} />
      </section>

      <section className="rounded-xl border border-border">
        <SectionHead>Contactability</SectionHead>
        <KV k="Contactability" v={p.contactability} />
        <KV k="Quality" v={p.contact_quality} />
        <KV k="Email" v={p.contact_email} />
        <KV
          k="Last contacted"
          v={
            p.last_contacted_at
              ? new Date(p.last_contacted_at).toISOString()
              : null
          }
        />
      </section>

      <section className="rounded-xl border border-border">
        <SectionHead>Next action</SectionHead>
        <p className="text-[13px]">{p.next_action ?? "—"}</p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Follow-up {p.follow_up_date ?? "—"}
        </p>
      </section>

      <section className="rounded-xl border border-border">
        <SectionHead>Stage transition</SectionHead>
        <div className="flex items-center gap-2">
          <Select value={stage} onValueChange={(v) => setStage(v)}>
            {detail.allowedTransitions.map((s) => (
              <option key={s} value={s}>
                {label("stage", s)}
              </option>
            ))}
          </Select>
          <Button size="sm" onClick={() => void transition(stage)}>
            Save stage
          </Button>
        </div>
        <p className="mt-2 text-[12px] text-muted-foreground">
          Allowed from <strong>{p.stage}</strong>:{" "}
          {detail.allowedTransitions.join(", ") || "terminal"}
        </p>
      </section>

      <section className="rounded-xl border border-border">
        <SectionHead>Gate checklist</SectionHead>
        <GateRows prospect={p} />
      </section>
    </div>
  );
}

function SectionHead({ children }: { children: ReactNode }) {
  return (
    <div className="border-b border-border px-4 py-2.5 text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </div>
  );
}

function KV({ k, v }: { k: string; v?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium">{v ?? "—"}</span>
    </div>
  );
}

function GateRows({ prospect }: { prospect: ProspectWithRelations }) {
  const research = researchMissing(prospect);
  const qualification = qualificationMissing(prospect);
  return (
    <div className="space-y-3 px-4 py-3">
      <div>
        <p className="mb-1 text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">
          Research gate ({research.length} missing)
        </p>
        {research.length === 0 && (
          <p className="text-[12.5px] text-emerald-600">Research complete.</p>
        )}
        {research.map((r) => (
          <p key={r.key} className="text-[12.5px]">
            {r.ok ? "✓" : "✕"} {r.label}
          </p>
        ))}
      </div>
      <div>
        <p className="mb-1 text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">
          Qualification gate ({qualification.length} missing)
        </p>
        {qualification.length === 0 && (
          <p className="text-[12.5px] text-emerald-600">Qualified.</p>
        )}
        {qualification.map((r) => (
          <p key={r.key} className="text-[12.5px]">
            {r.ok ? "✓" : "✕"} {r.label}
          </p>
        ))}
      </div>
    </div>
  );
}

function ResearchTab({ detail }: { detail: Detail }) {
  const p = detail.prospect;
  const { toast } = useToast();
  const [form, setForm] = useState({
    industry: p.industry_slug ?? "",
    business_type_id: p.business_type_id ?? "",
    company_size: p.company_size ?? "UNKNOWN",
    employee_count: String(p.employee_count ?? ""),
    country_code: p.country_code ?? "",
    city: p.city ?? "",
    region: p.region ?? "",
    fit: p.fit ?? "UNKNOWN",
    priority: p.priority ?? "MEDIUM",
    opportunities: (p.opportunities ?? []).join(","),
    services: (p.services ?? []).join(","),
    contact_name: p.contact_name ?? "",
    contact_first_name: p.contact_first_name ?? "",
    contact_last_name: p.contact_last_name ?? "",
    contact_email: p.contact_email ?? "",
    contact_role: p.contact_role ?? "",
    contact_quality: p.contact_quality ?? "UNKNOWN",
    next_action: p.next_action ?? "",
    follow_up_date: p.follow_up_date ?? "",
    website: p.website ?? "",
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    const res = await fetch(`/api/prospects/${p.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        industry: form.industry || undefined,
        business_type_id: form.business_type_id || undefined,
        company_size: form.company_size || undefined,
        employee_count: form.employee_count
          ? Number(form.employee_count)
          : undefined,
        country_code: form.country_code || undefined,
        city: form.city || undefined,
        region: form.region || undefined,
        fit: form.fit || undefined,
        priority: form.priority || undefined,
        opportunities: form.opportunities
          ? form.opportunities.split(",").filter(Boolean)
          : undefined,
        services: form.services
          ? form.services.split(",").filter(Boolean)
          : undefined,
        contact_name: form.contact_name || undefined,
        contact_first_name: form.contact_first_name || undefined,
        contact_last_name: form.contact_last_name || undefined,
        contact_email: form.contact_email || undefined,
        contact_role: form.contact_role || undefined,
        contact_quality: form.contact_quality || undefined,
        next_action: form.next_action || undefined,
        follow_up_date: form.follow_up_date || undefined,
        website: form.website || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok)
      toast("error", { description: data?.error?.message ?? "Save failed" });
    else toast("success", { description: "Saved" });
  };

  const qualify = async (to: "RESEARCHED" | "QUALIFIED") => {
    const res = await fetch(`/api/prospects/${p.id}/qualify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ to }),
    });
    const data = await res.json();
    if (!res.ok)
      toast("error", { description: data?.error?.message ?? "Gate failed" });
    else toast("success", { description: `Marked ${to}` });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-semibold">Classification</span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void qualify("RESEARCHED")}
        >
          Mark researched
        </Button>
        <Button size="sm" onClick={() => void qualify("QUALIFIED")}>
          Qualify
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Industry">
          <Select
            value={form.industry}
            onValueChange={(v) => set("industry", v)}
          >
            <option value="">—</option>
            {INDUSTRY_OPTIONS.map(([slug, labelText]) => (
              <option key={slug} value={slug}>
                {labelText}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Business type">
          <Input
            value={form.business_type_id}
            onChange={(e) => set("business_type_id", e.target.value)}
            placeholder="uuid or label"
          />
        </Field>
        <Field label="Company size">
          <Select
            value={form.company_size}
            onValueChange={(v) => set("company_size", v)}
          >
            {SIZE_OPTIONS.map(([slug, labelText]) => (
              <option key={slug} value={slug}>
                {labelText}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Fit">
          <Select value={form.fit} onValueChange={(v) => set("fit", v)}>
            <option value="UNKNOWN">Unknown</option>
            <option value="POSSIBLE">Possible</option>
            <option value="POOR">Poor</option>
            <option value="GOOD">Good</option>
            <option value="STRONG">Strong</option>
          </Select>
        </Field>
        <Field label="Priority">
          <Select
            value={form.priority}
            onValueChange={(v) => set("priority", v)}
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="DISQUALIFIED">Disqualified</option>
          </Select>
        </Field>
        <Field label="Contact quality">
          <Select
            value={form.contact_quality}
            onValueChange={(v) => set("contact_quality", v)}
          >
            <option value="UNKNOWN">Unknown</option>
            <option value="UNVERIFIED">Unverified</option>
            <option value="VERIFIED">Verified</option>
            <option value="BOUNCED">Bounced</option>
          </Select>
        </Field>
      </div>

      <Field label="Opportunities (comma separated slugs)">
        <Input
          value={form.opportunities}
          onChange={(e) => set("opportunities", e.target.value)}
          placeholder="NO_WEBSITE, OUTDATED_WEBSITE"
        />
      </Field>
      <Field label="Services (comma separated slugs)">
        <Input
          value={form.services}
          onChange={(e) => set("services", e.target.value)}
          placeholder="WEBSITE_REDESIGN, BOOKING_SYSTEM"
        />
      </Field>

      <Field label="Contact name">
        <Input
          value={form.contact_name}
          onChange={(e) => set("contact_name", e.target.value)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name">
          <Input
            value={form.contact_first_name}
            onChange={(e) => set("contact_first_name", e.target.value)}
          />
        </Field>
        <Field label="Last name">
          <Input
            value={form.contact_last_name}
            onChange={(e) => set("contact_last_name", e.target.value)}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Contact email">
          <Input
            value={form.contact_email}
            onChange={(e) => set("contact_email", e.target.value)}
          />
        </Field>
        <Field label="Contact role">
          <Input
            value={form.contact_role}
            onChange={(e) => set("contact_role", e.target.value)}
          />
        </Field>
      </div>

      <Field label="Country code">
        <Input
          value={form.country_code}
          onChange={(e) => set("country_code", e.target.value)}
          placeholder="GB"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="City">
          <Input
            value={form.city}
            onChange={(e) => set("city", e.target.value)}
          />
        </Field>
        <Field label="Region">
          <Input
            value={form.region}
            onChange={(e) => set("region", e.target.value)}
          />
        </Field>
      </div>
      <Field label="Website">
        <Input
          value={form.website}
          onChange={(e) => set("website", e.target.value)}
        />
      </Field>
      <Field label="Next action">
        <Input
          value={form.next_action}
          onChange={(e) => set("next_action", e.target.value)}
        />
      </Field>
      <Field label="Follow-up date">
        <Input
          type="date"
          value={form.follow_up_date}
          onChange={(e) => set("follow_up_date", e.target.value)}
        />
      </Field>

      <Button size="sm" onClick={() => void save}>
        Save classification
      </Button>
    </div>
  );
}

const INDUSTRY_OPTIONS = [
  ["PROFESSIONAL_SERVICES", "Professional Services"],
  ["HEALTHCARE", "Healthcare"],
  ["HOME_SERVICES", "Home Services"],
  ["CONSTRUCTION_TRADES", "Construction & Trades"],
  ["PROPERTY_REAL_ESTATE", "Property & Real Estate"],
  ["HOSPITALITY_FOOD", "Hospitality & Food"],
  ["BEAUTY_WELLNESS", "Beauty & Wellness"],
  ["RETAIL_ECOMMERCE", "Retail & E-commerce"],
  ["AUTOMOTIVE", "Automotive"],
  ["EDUCATION_TRAINING", "Education & Training"],
  ["TECHNOLOGY", "Technology"],
  ["FINANCE_INSURANCE", "Finance & Insurance"],
  ["CREATIVE_MEDIA", "Creative & Media"],
  ["TRAVEL_TOURISM", "Travel & Tourism"],
  ["AGRICULTURE", "Agriculture"],
  ["MANUFACTURING", "Manufacturing"],
  ["OTHER", "Other"],
] as const;

const SIZE_OPTIONS = [
  ["SOLO", "Solo"],
  ["MICRO", "Micro"],
  ["SMALL", "Small"],
  ["SMALL_MEDIUM", "Small–Medium"],
  ["MEDIUM", "Medium"],
  ["LARGE", "Large"],
  ["UNKNOWN", "Unknown"],
] as const;

function TimelineTab({ detail }: { detail: Detail }) {
  const items = [
    ...detail.events.map((e) => ({
      id: e.id,
      type: e.type,
      payload: e.payload,
      at: e.createdAt,
    })),
    ...detail.messages
      .filter((m) => m.status !== "QUEUED")
      .map((m) => ({
        id: `m-${m.id}`,
        type: "message",
        payload: { subject: m.subject, status: m.status },
        at: m.sentAt ?? "",
      })),
  ];
  return (
    <div className="flex flex-col gap-2">
      {items.length === 0 && (
        <p className="text-[13px] text-muted-foreground">No activity yet.</p>
      )}
      {[...items]
        .sort((a, b) => String(b.at).localeCompare(String(a.at)))
        .map((e) => (
          <div key={e.id} className="rounded-lg border border-border px-3 py-2">
            <p className="text-[12.5px] font-semibold capitalize">
              {e.type.replace(/_/g, " ")}
            </p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              {formatWorkspaceDate(e.at)}
            </p>
          </div>
        ))}
    </div>
  );
}

function EmailsTab({ detail }: { detail: Detail }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
        <h3 className="text-[13px] font-semibold">Draft only</h3>
        <p className="text-[12px] text-muted-foreground">
          Sending is disabled. Prepare and save the first email in Outreach.
        </p>
        <Link
          href={`/outreach?prospect=${detail.prospect.id}`}
          className="text-[13px] font-semibold text-primary hover:underline"
        >
          Open draft editor
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        {detail.messages.length === 0 && (
          <p className="text-[13px] text-muted-foreground">No emails yet.</p>
        )}
        {detail.messages.map((m) => (
          <div key={m.id} className="rounded-lg border border-border px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-semibold">{m.subject}</p>
              <span className="text-[11px] font-medium text-muted-foreground uppercase">
                {m.status}
              </span>
            </div>
            <p className="mt-1 text-[12px] text-muted-foreground">{m.bodyMd}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {m.openCount} opens
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function NotesTab({ detail }: { detail: Detail }) {
  const { toast } = useToast();
  const [body, setBody] = useState("");

  const add = async () => {
    if (!body.trim()) return;
    const res = await fetch(`/api/prospects/${detail.prospect.id}/notes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body }),
    });
    const data = await res.json();
    if (!res.ok)
      toast("error", { description: data?.error?.message ?? "Failed" });
    else {
      setBody("");
      toast("success", { description: "Note added" });
      routerPushRefresh();
    }
  };

  const routerPushRefresh = () => {
    // Reload detail via parent callback pattern not available here; use window reload of drawer content through event.
    window.dispatchEvent(new Event("prospect:refresh"));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a note…"
        />
        <Button size="sm" onClick={() => void add} disabled={!body.trim()}>
          Add note
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        {detail.notes.map((n) => (
          <div key={n.id} className="rounded-lg border border-border px-3 py-2">
            <p className="text-[13px] whitespace-pre-wrap">{n.bodyMd}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {n.createdAt}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
