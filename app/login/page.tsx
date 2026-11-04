"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

export default function Login() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/signin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setError(data?.error?.message ?? "Sign-in failed");
      return;
    }
    toast("success", { description: "Signed in" });
    window.location.href = "/dashboard";
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <RadarIcon />
          </span>
          <h1 className="text-xl font-semibold tracking-tight">Outbound OS</h1>
          <p className="text-[13px] text-muted-foreground">Sign in with an allowed workspace address</p>
        </div>
        <form onSubmit={(e) => void submit(e)} className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Email</label>
          <input
            className="field mb-4"
            type="email"
            required
            autoComplete="email"
            placeholder="sam@acmestudio.co"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {error && <p className="mb-3 text-[12px] text-destructive">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? <Loader2 className="size-4 animate-spin" /> : "Continue"}
          </Button>
          <p className="mt-4 text-[11.5px] text-muted-foreground">
            Demo mode — use <code className="rounded bg-muted px-1">sam@acmestudio.co</code>,{" "}
            <code className="rounded bg-muted px-1">amelia@acmestudio.co</code> or{" "}
            <code className="rounded bg-muted px-1">noah@acmestudio.co</code>.
          </p>
        </form>
      </div>
    </div>
  );
}

function RadarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="4" />
      <path d="m12 2 8 8-8 8-8-8z" />
    </svg>
  );
}
