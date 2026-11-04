"use client";

import * as React from "react";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "default" | "success" | "error" | "warning";
type ToastItem = { id: number; title: string; description?: string; tone: Tone };

type Ctx = { toast: (t: string, opts?: { description?: string; tone?: Tone }) => void };

const ToastContext = React.createContext<Ctx | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const idRef = React.useRef(0);

  const remove = React.useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = React.useCallback((title: string, opts?: { description?: string; tone?: Tone }) => {
    const id = ++idRef.current;
    setItems((prev) => [...prev, { id, title, description: opts?.description, tone: opts?.tone ?? "default" }]);
    setTimeout(() => remove(id), 5000);
  }, [remove]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-[100] flex w-full max-w-md -translate-x-1/2 flex-col items-center gap-2 px-4" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              "animate-toast pointer-events-auto flex w-full items-start gap-2.5 rounded-lg border px-3.5 py-2.5 shadow-lg",
              t.tone === "error" && "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100",
              t.tone === "success" && "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
              t.tone === "warning" && "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100",
              t.tone === "default" && "border-border bg-card text-foreground",
            )}
            role={t.tone === "error" ? "alert" : "status"}
          >
            <span className="mt-0.5">
              {t.tone === "success" ? <CheckCircle2 className="size-4" /> :
               t.tone === "error" ? <TriangleAlert className="size-4" /> :
               t.tone === "warning" ? <TriangleAlert className="size-4" /> : <Info className="size-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold leading-5">{t.title}</p>
              {t.description && <p className="mt-0.5 text-[12px] opacity-80">{t.description}</p>}
            </div>
            <button onClick={() => remove(t.id)} className="opacity-60 hover:opacity-100" aria-label="Dismiss">
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
