"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function Menu({
  trigger, children, align = "end", className,
}: {
  trigger: React.ReactNode;
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
  align?: "start" | "end";
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex">
      <span onClick={() => setOpen((v) => !v)} className="contents">{trigger}</span>
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute top-[calc(100%+4px)] z-50 min-w-[190px] overflow-hidden rounded-lg border border-border bg-card p-1 shadow-lg",
            align === "end" ? "right-0" : "left-0",
            className,
          )}
        >
          {typeof children === "function" ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  onClick, children, danger, disabled, checked,
}: {
  onClick?: () => void;
  children: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  checked?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-muted disabled:opacity-40",
        danger && "text-destructive",
      )}
    >
      <span className="flex-1">{children}</span>
      {checked && <Check className="size-3.5 text-primary" />}
    </button>
  );
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-2 py-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">{children}</div>;
}

export function MenuSeparator() {
  return <div className="my-1 h-px bg-border" />;
}
