"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Field,
  Input,
  Select,
  Switch,
} from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/page-header";

const TABS = [
  "Workspace",
  "Integrations",
  "Taxonomy",
  "Team",
  "Suppression",
  "Audit",
] as const;

type SettingsData = {
  id: string;
  name: string;
  timezone: string;
  sendWindowStart: string;
  sendWindowEnd: string;
  dailySendCap: number;
  hourlySendCap: number;
  trackOpens: boolean;
  trackClicks: boolean;
  unsubscribeFooter: boolean;
  footerText: string;
};

type Integration = {
  kind: string;
  label: string | null;
  config: Record<string, unknown>;
  secretMasked: string;
  verifiedAt: string | null;
  lastError: string | null;
  mode: string;
  configured: boolean;
};

type BusinessType = {
  id: string;
  industrySlug: string;
  label: string;
  slug: string;
  isSystem: boolean;
  archivedAt: string | null;
  usage: number;
};

export default function SettingsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Workspace");
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <PageHeader
        title="Settings"
        description="Manage this workspace, integrations and safety controls."
      />
      <div className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`border-b-2 px-3 py-2 text-[13px] font-medium ${
              tab === t
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Workspace" && <WorkspaceTab />}
      {tab === "Integrations" && <IntegrationsTab />}
      {tab === "Taxonomy" && <TaxonomyTab />}
      {tab === "Team" && <TeamTab />}
      {tab === "Suppression" && <SuppressionTab />}
      {tab === "Audit" && <AuditTab />}
    </div>
  );
}

function useFetch<T>(path: string, refreshKey?: unknown) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let on = true;
    setLoading(true);
    void fetch(`${path}${refreshKey ? `?refresh=${String(refreshKey)}` : ""}`, {
      cache: "no-store",
    })
      .then(async (r) => ({ ok: r.ok, json: await r.json() }))
      .then(({ ok, json }) => {
        if (!on) return;
        if (!ok) throw new Error(json?.error?.message ?? "Request failed");
        setData(json);
      })
      .catch(() => undefined)
      .finally(() => on && setLoading(false));
    return () => {
      on = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, refreshKey]);
  return { data, loading, error: null };
}

function WorkspaceTab() {
  const { data, loading } = useFetch<SettingsData>("/api/settings");
  const { toast } = useToast();
  const [form, setForm] = useState<SettingsData | null>(null);
  const current = form ?? data;

  if (loading || !current)
    return <p className="text-[13px] text-muted-foreground">Loading…</p>;

  const set = (k: keyof SettingsData, v: unknown) =>
    setForm({ ...current, [k]: v });

  const save = async () => {
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: current.name,
        timezone: current.timezone,
        sendWindowStart: current.sendWindowStart,
        sendWindowEnd: current.sendWindowEnd,
        dailySendCap: current.dailySendCap,
        hourlySendCap: current.hourlySendCap,
        trackOpens: current.trackOpens,
        trackClicks: current.trackClicks,
        unsubscribeFooter: current.unsubscribeFooter,
        footerText: current.footerText,
      }),
    });
    const json = await res.json();
    if (!res.ok)
      toast("error", { description: json?.error?.message ?? "Save failed" });
    else toast("success", { description: "Workspace updated" });
  };

  return (
    <div className="flex max-w-2xl flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <h3 className="text-[13px] font-semibold tracking-tight">Workspace</h3>
      <Field label="Workspace name">
        <Input
          value={current.name}
          onChange={(e) => set("name", e.target.value)}
        />
      </Field>
      <Field label="Timezone">
        <Select
          value={current.timezone}
          onValueChange={(v) => set("timezone", v)}
        >
          {[
            "Europe/London",
            "Europe/Zurich",
            "Europe/Berlin",
            "America/New_York",
            "America/Los_Angeles",
            "Australia/Sydney",
            "Asia/Jerusalem",
          ].map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Send window start">
          <Input
            value={current.sendWindowStart}
            onChange={(e) => set("sendWindowStart", e.target.value)}
          />
        </Field>
        <Field label="Send window end">
          <Input
            value={current.sendWindowEnd}
            onChange={(e) => set("sendWindowEnd", e.target.value)}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Daily send cap" hint="Per user">
          <Input
            type="number"
            value={String(current.dailySendCap)}
            onChange={(e) => set("dailySendCap", Number(e.target.value))}
          />
        </Field>
        <Field label="Hourly send cap" hint="Per workspace">
          <Input
            type="number"
            value={String(current.hourlySendCap)}
            onChange={(e) => set("hourlySendCap", Number(e.target.value))}
          />
        </Field>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
        <div>
          <p className="text-[13px] font-medium">Track opens</p>
          <p className="text-[11.5px] text-muted-foreground">
            1×1 tracking pixel.
          </p>
        </div>
        <Switch
          checked={!!current.trackOpens}
          onChange={(v) => set("trackOpens", v)}
          label="Track opens"
        />
      </div>
      <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
        <div>
          <p className="text-[13px] font-medium">Track clicks</p>
          <p className="text-[11.5px] text-muted-foreground">
            Rewrite outbound links to the tracking endpoint.
          </p>
        </div>
        <Switch
          checked={!!current.trackClicks}
          onChange={(v) => set("trackClicks", v)}
          label="Track clicks"
        />
      </div>
      <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
        <div>
          <p className="text-[13px] font-medium">Unsubscribe footer</p>
        </div>
        <Switch
          checked={!!current.unsubscribeFooter}
          onChange={(v) => set("unsubscribeFooter", v)}
          label="Unsubscribe footer"
        />
      </div>
      <Field label="Footer text">
        <textarea
          className="field min-h-20"
          value={current.footerText ?? ""}
          onChange={(e) => set("footerText", e.target.value)}
        />
      </Field>
      <Button size="sm" onClick={() => void save()}>
        Save workspace
      </Button>
    </div>
  );
}

function IntegrationsTab() {
  const { data, loading } = useFetch<
    { integrations?: Integration[] } | Integration[]
  >("/api/integrations");
  const { toast } = useToast();
  const list = (
    Array.isArray(data) ? data : (data?.integrations ?? [])
  ) as Integration[];
  const [testState, setTestState] = useState<
    Record<string, { ok: boolean; message: string }>
  >({});

  const runTest = async (kind: string) => {
    const res = await fetch(`/api/integrations/${kind}/test`, {
      method: "POST",
    });
    const json = await res.json();
    if (!res.ok) {
      toast("error", { description: json?.error?.message ?? "Test failed" });
      return;
    }
    setTestState((s) => ({ ...s, [kind]: json }));
  };

  if (loading)
    return <p className="text-[13px] text-muted-foreground">Loading…</p>;

  return (
    <div className="flex max-w-2xl flex-col gap-3">
      {list.map((i) => (
        <div
          key={i.kind}
          className="rounded-xl border border-border bg-card p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
                {i.kind}
              </p>
              <p className="mt-0.5 text-[13px] font-medium">
                {i.label ?? i.kind}
              </p>
              {i.secretMasked && (
                <p className="text-[11.5px] text-muted-foreground">
                  Secret {i.secretMasked}
                </p>
              )}
              {i.verifiedAt && (
                <p className="text-[11.5px] text-muted-foreground">
                  Verified {new Date(i.verifiedAt).toISOString()}
                </p>
              )}
              {i.lastError && (
                <p className="text-[11.5px] text-red-600">{i.lastError}</p>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void runTest(i.kind)}
            >
              Test connection
            </Button>
          </div>
          {testState[i.kind] && (
            <p className="mt-2 text-[12px] text-emerald-700">
              {testState[i.kind].message}
            </p>
          )}
        </div>
      ))}
      <p className="text-[12px] text-muted-foreground">
        Provider mode is controlled by{" "}
        <code className="rounded bg-muted px-1">MOCK_PROVIDERS</code> in{" "}
        <code>.env</code>. Live credentials live in the integration secrets
        store.
      </p>
    </div>
  );
}

function TaxonomyTab() {
  const { data, loading } = useFetch<{ businessTypes?: BusinessType[] }>(
    "/api/taxonomy",
  );
  const { toast } = useToast();
  const [industrySlug, setIndustrySlug] = useState("HEALTHCARE");
  const [label, setLabel] = useState("");

  if (loading)
    return <p className="text-[13px] text-muted-foreground">Loading…</p>;

  const types = (data?.businessTypes ?? []) as BusinessType[];

  const create = async () => {
    const res = await fetch("/api/taxonomy/business-types", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ industrySlug, label }),
    });
    const json = await res.json();
    if (!res.ok)
      toast("error", { description: json?.error?.message ?? "Failed" });
    else {
      setLabel("");
      toast("success", { description: "Business type created" });
    }
  };

  const archive = async (id: string) => {
    const res = await fetch(`/api/taxonomy/business-types/${id}`, {
      method: "DELETE",
    });
    const json = await res.json();
    if (!res.ok)
      toast("error", { description: json?.error?.message ?? "Failed" });
    else toast("success", { description: "Archived" });
  };

  return (
    <div className="flex max-w-3xl flex-col gap-3">
      <div className="flex items-end gap-2">
        <Field label="Industry">
          <Select value={industrySlug} onValueChange={setIndustrySlug}>
            {[
              "HEALTHCARE",
              "HOME_SERVICES",
              "CONSTRUCTION_TRADES",
              "PROFESSIONAL_SERVICES",
              "HOSPITALITY_FOOD",
              "BEAUTY_WELLNESS",
              "TECHNOLOGY",
              "CREATIVE_MEDIA",
              "OTHER",
            ].map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Label">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Dental group"
          />
        </Field>
        <Button
          size="sm"
          onClick={() => void create()}
          disabled={!label.trim()}
        >
          Create type
        </Button>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                Label
              </th>
              <th className="px-3 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                Industry
              </th>
              <th className="px-3 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                Usage
              </th>
              <th className="w-24 px-3 py-2 text-right text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {types.map((t) => (
              <tr key={t.id} className="border-t border-border">
                <td className="px-3 py-2 font-medium">{t.label}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {t.industrySlug}
                </td>
                <td className="px-3 py-2">{t.usage}</td>
                <td className="px-3 py-2 text-right">
                  {!t.isSystem && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void archive(t.id)}
                    >
                      Archive
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TeamTab() {
  const { data, loading } =
    useFetch<
      Array<{
        id: string;
        name: string;
        email: string;
        role: string;
        status: string;
      }>
    >("/api/team");
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("MEMBER");

  const invite = async () => {
    const res = await fetch("/api/team/invite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, name, role }),
    });
    const json = await res.json();
    if (!res.ok)
      toast("error", { description: json?.error?.message ?? "Failed" });
    else {
      setEmail("");
      toast("success", { description: "Invitation sent" });
    }
  };

  if (loading)
    return <p className="text-[13px] text-muted-foreground">Loading…</p>;
  const users = data ?? [];

  return (
    <div className="flex max-w-2xl flex-col gap-3">
      <div className="flex items-end gap-2">
        <Field label="Email">
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="new@acmestudio.co"
          />
        </Field>
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Role">
          <Select value={role} onValueChange={setRole}>
            <option value="MEMBER">Member</option>
            <option value="ADMIN">Admin</option>
          </Select>
        </Field>
        <Button
          size="sm"
          onClick={() => void invite()}
          disabled={!email.trim()}
        >
          Invite
        </Button>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                Name
              </th>
              <th className="px-3 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                Email
              </th>
              <th className="px-3 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                Role
              </th>
              <th className="px-3 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-3 py-2 font-medium">{u.name}</td>
                <td className="px-3 py-2 text-muted-foreground">{u.email}</td>
                <td className="px-3 py-2">{u.role}</td>
                <td className="px-3 py-2">{u.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SuppressionTab() {
  const { data, loading } =
    useFetch<
      Array<{
        id: string;
        emailNormalized: string;
        reason: string;
        source: string;
        createdAt: string;
      }>
    >("/api/suppressions");
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("MANUAL");

  const add = async () => {
    const res = await fetch("/api/suppressions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ emails: [email], reason }),
    });
    const json = await res.json();
    if (!res.ok)
      toast("error", { description: json?.error?.message ?? "Failed" });
    else {
      setEmail("");
      toast("success", { description: "Added to suppression list" });
    }
  };

  if (loading)
    return <p className="text-[13px] text-muted-foreground">Loading…</p>;
  const rows = data ?? [];

  return (
    <div className="flex max-w-3xl flex-col gap-3">
      <div className="flex items-end gap-2">
        <Field label="Email">
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="person@example.com"
          />
        </Field>
        <Field label="Reason">
          <Select value={reason} onValueChange={setReason}>
            <option value="UNSUBSCRIBED">Unsubscribed</option>
            <option value="HARD_BOUNCE">Hard bounce</option>
            <option value="COMPLAINT">Complaint</option>
            <option value="MANUAL">Manual</option>
            <option value="INVALID">Invalid</option>
          </Select>
        </Field>
        <Button size="sm" onClick={() => void add()} disabled={!email.trim()}>
          Add
        </Button>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                Email
              </th>
              <th className="px-3 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                Reason
              </th>
              <th className="px-3 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                Source
              </th>
              <th className="w-14 px-3 py-2 text-right text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-3 py-2">{r.emailNormalized}</td>
                <td className="px-3 py-2">{r.reason}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.source}</td>
                <td className="px-3 py-2 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void fetch(`/api/suppressions/${r.id}`, {
                        method: "DELETE",
                      })
                    }
                  >
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AuditTab() {
  const { data, loading } = useFetch<{
    rows?: Array<{
      id: string;
      action: string;
      targetType: string | null;
      targetId: string | null;
      createdAt: string;
    }>;
    total: number;
  }>("/api/audit?page=1");
  if (loading)
    return <p className="text-[13px] text-muted-foreground">Loading…</p>;
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <p className="text-[12.5px] text-muted-foreground">
        {total} audit events
      </p>
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-left text-[12px]">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-2 py-1.5 font-semibold">Action</th>
              <th className="px-2 py-1.5 font-semibold">Target</th>
              <th className="px-2 py-1.5 font-semibold">When</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-2 py-1.5">{r.action}</td>
                <td className="px-2 py-1.5 text-muted-foreground">{`${r.targetType ?? ""} ${r.targetId ?? ""}`}</td>
                <td className="px-2 py-1.5 text-muted-foreground">
                  {r.createdAt}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
