import * as React from "react";
import { cn } from "@/lib/utils";

/* ── Button ─────────────────────────────────────────────────────────────── */

type ButtonVariant =
  "default" | "secondary" | "outline" | "ghost" | "destructive" | "link";
type ButtonSize = "sm" | "md" | "lg" | "icon";

const buttonVariants: Record<ButtonVariant, string> = {
  default: "bg-primary text-primary-foreground hover:brightness-110 shadow-sm",
  secondary: "bg-secondary text-secondary-foreground hover:bg-muted",
  outline: "border border-border bg-card text-foreground hover:bg-muted",
  ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
  destructive:
    "bg-destructive text-destructive-foreground hover:brightness-110",
  link: "text-primary underline-offset-4 hover:underline p-0 h-auto",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5 text-[13px] rounded-[7px]",
  md: "h-9 px-3.5 text-sm rounded-lg",
  lg: "h-10 px-5 text-sm rounded-lg",
  icon: "h-9 w-9 rounded-lg",
};

export function buttonClass(
  variant: ButtonVariant = "default",
  size: ButtonSize = "md",
  className?: string,
) {
  return cn(
    "inline-flex items-center justify-center gap-1.5 font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    buttonVariants[variant],
    buttonSizes[size],
    className,
  );
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "default", size = "md", type = "button", ...props },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      className={buttonClass(variant, size, className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";

/* ── Card ───────────────────────────────────────────────────────────────── */

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-4 py-3 border-b border-border",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-sm font-semibold tracking-tight", className)}
      {...props}
    />
  );
}

export function CardBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4", className)} {...props} />;
}

/* ── Badge ──────────────────────────────────────────────────────────────── */

export type BadgeTone =
  | "neutral"
  | "violet"
  | "blue"
  | "cyan"
  | "indigo"
  | "amber"
  | "teal"
  | "green"
  | "red"
  | "outline"
  | "purple";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-secondary text-secondary-foreground border-border",
  violet: "bg-accent text-accent-foreground border-transparent",
  blue: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900",
  cyan: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-900",
  indigo:
    "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-900",
  amber:
    "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900",
  teal: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-900",
  green:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900",
  red: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-900",
  purple:
    "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-900",
  outline: "bg-transparent text-foreground border-border",
};

export function Badge({
  tone = "neutral",
  className,
  dot,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-4 whitespace-nowrap",
        tones[tone],
        className,
      )}
      {...props}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {props.children}
    </span>
  );
}

export const STAGE_TONES: Record<string, BadgeTone> = {
  NEW: "neutral",
  RESEARCHED: "blue",
  QUALIFIED: "indigo",
  CONTACTED: "cyan",
  FOLLOW_UP: "amber",
  REPLIED: "violet",
  MEETING: "teal",
  PROPOSAL: "purple",
  WON: "green",
  LOST: "neutral",
  DISQUALIFIED: "red",
};
export const FIT_TONES: Record<string, BadgeTone> = {
  STRONG: "green",
  GOOD: "teal",
  POSSIBLE: "amber",
  POOR: "red",
  UNKNOWN: "neutral",
};
export const PRIORITY_TONES: Record<string, BadgeTone> = {
  HIGH: "red",
  MEDIUM: "amber",
  LOW: "neutral",
  DISQUALIFIED: "red",
};
export const CONTACTABILITY_TONES: Record<string, BadgeTone> = {
  OK: "green",
  BOUNCED: "red",
  UNSUBSCRIBED: "amber",
  DO_NOT_CONTACT: "red",
};

/* ── Form controls ──────────────────────────────────────────────────────── */

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn("field", className)} {...props} />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn("field", className)} {...props} />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & {
    value?: string;
    onValueChange?: (v: string) => void;
    children?: React.ReactNode;
  }
>(({ className, value, onValueChange, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn("field appearance-none pr-8 cursor-pointer", className)}
    value={value}
    onChange={(e) => onValueChange?.(e.target.value)}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "block text-xs font-semibold text-muted-foreground mb-1.5",
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const generatedId = React.useId();
  const control = React.isValidElement<Record<string, unknown>>(children)
    ? React.cloneElement(children, {
        id: children.props.id ?? generatedId,
        "aria-describedby":
          hint || error
            ? `${generatedId}-description`
            : children.props["aria-describedby"],
      })
    : children;
  return (
    <div className={className}>
      {label && <Label htmlFor={generatedId}>{label}</Label>}
      {control}
      {error ? (
        <p
          id={`${generatedId}-description`}
          className="mt-1 text-[11.5px] text-destructive"
        >
          {error}
        </p>
      ) : hint ? (
        <p
          id={`${generatedId}-description`}
          className="mt-1 text-[11.5px] text-muted-foreground"
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
        checked ? "bg-primary" : "bg-input",
      )}
    >
      <span
        className={cn(
          "inline-block size-4 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-[18px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

/* ── Misc ───────────────────────────────────────────────────────────────── */

export function Avatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <span
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-full border border-border bg-accent text-[11px] font-bold text-accent-foreground",
        className,
      )}
    >
      {initials}
    </span>
  );
}

export function Separator({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-border", className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-md h-4 w-full", className)} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {icon && <div className="mb-1 text-muted-foreground/70">{icon}</div>}
      <p className="text-sm font-semibold">{title}</p>
      {description && (
        <p className="max-w-sm text-[13px] text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
      {children}
    </kbd>
  );
}

export function ProgressBar({
  value,
  tone = "default",
}: {
  value: number;
  tone?: "default" | "danger";
}) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn(
          "h-full rounded-full transition-all",
          tone === "danger" ? "bg-destructive" : "bg-primary",
        )}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}
