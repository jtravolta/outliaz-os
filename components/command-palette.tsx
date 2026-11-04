"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "lucide-react";

type Item = {
  id: string;
  label: string;
  hint?: string;
  href?: string;
  action?: () => void;
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const items = useMemo<Item[]>(() => {
    const base: Item[] = [
      { id: "dashboard", label: "Dashboard", href: "/dashboard" },
      { id: "prospects", label: "Prospects", href: "/prospects" },
      { id: "sources", label: "Sources", href: "/sources" },
      { id: "runs", label: "Runs", href: "/runs" },
      { id: "sequences", label: "Sequences", href: "/sequences" },
      { id: "inbox", label: "Inbox", href: "/inbox" },
      { id: "library", label: "Library", href: "/library" },
      { id: "reports", label: "Reports", href: "/reports" },
      { id: "settings", label: "Settings", href: "/settings" },
      { id: "setup", label: "Setup", href: "/setup" },
      {
        id: "import",
        label: "Import CSV",
        href: "/prospects/import",
        action: () => router.push("/prospects/import"),
      },
      {
        id: "new-prospect",
        label: "New prospect",
        href: "/prospects/new",
        action: () => router.push("/prospects/new"),
      },
      {
        id: "new-source",
        label: "New source",
        href: "/sources/new",
        action: () => router.push("/sources/new"),
      },
    ];
    const q = query.trim().toLowerCase();
    const filtered = q
      ? base.filter((i) => i.label.toLowerCase().includes(q))
      : base;
    return filtered.slice(0, 12);
  }, [query, router]);

  if (!open) {
    return (
      <button
        data-command-launcher
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-4 z-50 flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-[13px] font-medium text-muted-foreground shadow-lg hover:text-foreground"
      >
        <Command className="size-4" aria-hidden="true" />{" "}
        <span className="hidden sm:inline">Search…</span>{" "}
        <kbd
          aria-hidden="true"
          className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]"
        >
          ⌘K
        </kbd>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center px-4 pt-24">
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        onClick={() => setOpen(false)}
      />
      <div className="relative w-full max-w-xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <span className="text-muted-foreground">
            <Command className="size-4" />
          </span>
          <input
            autoFocus
            className="field"
            placeholder="Jump to…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button onClick={() => setOpen(false)} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto p-1">
          {items.map((i) => (
            <button
              key={i.id}
              onClick={() => {
                setOpen(false);
                if (i.action) i.action();
                else if (i.href) router.push(i.href);
              }}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] hover:bg-muted"
            >
              <span>{i.label}</span>
              {i.hint && (
                <span className="text-[11.5px] text-muted-foreground">
                  {i.hint}
                </span>
              )}
            </button>
          ))}
          {items.length === 0 && (
            <p className="px-3 py-4 text-[13px] text-muted-foreground">
              No results.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
